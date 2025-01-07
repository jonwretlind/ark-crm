const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const { MongoClient } = require('mongodb');

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'ark_crm';

// Function to parse currency string to number
function parseCurrency(currency) {
    if (!currency || currency === '0') return 0;
    return parseFloat(currency.replace(/[$,]/g, ''));
}

// Function to parse date string to ISO format
function parseDate(dateStr) {
    if (!dateStr || dateStr === 'Past Due') return null;
    const [month, day, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Function to extract balance from comments
function extractBalance(comments) {
    if (!comments) return 0;
    const match = comments.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?) Past Due/);
    return match ? parseCurrency(match[1]) : 0;
}

// Function to determine payment method
function determinePaymentMethod(receiptNo) {
    if (!receiptNo) return 'Cash';
    if (receiptNo.toLowerCase().includes('zelle')) return 'Bank Transfer';
    if (receiptNo.toLowerCase() === 'tbd') return 'Pending';
    return 'Check';
}

// Function to determine if a payment should be included
function shouldIncludePayment(record) {
    if (!record['Resdent Name']) return false;
    if (record['Comments'] && record['Comments'].includes('Ark Sponsored')) return true;
    return (record['Date Rent Received'] && record['Amount Received']) ||
           (record['Comments'] && record['Comments'].includes('Past Due'));
}

// Function to process comments for notes
function processNotes(record) {
    const notes = [];
    if (record['Receipt No.'] && !['VOID', 'N/A', 'TBD'].includes(record['Receipt No.'])) {
        notes.push(`Receipt: ${record['Receipt No.']}`);
    }
    if (record['Comments']) {
        notes.push(record['Comments'].trim());
    }
    if (record['Late Fees'] && parseFloat(record['Late Fees']) > 0) {
        notes.push(`Late Fees: $${record['Late Fees']}`);
    }
    if (record['Comments'] && record['Comments'].includes('Ark Sponsored')) {
        notes.push('Program fees covered by Ark');
    }
    return notes.filter(note => note).join(' - ');
}

async function processPayments() {
    let client;
    try {
        // Connect to MongoDB
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(dbName);
        console.log('Connected to MongoDB');

        // Get all residents (current and past)
        const residents = await db.collection('contacts')
            .find({ 
                type: { 
                    $in: ['Resident', 'PastResident'] 
                }
            })
            .toArray();

        // Create resident map with status
        const residentMap = new Map();
        residents.forEach(resident => {
            const fullName = `${resident.firstName} ${resident.lastName}`;
            residentMap.set(fullName.toLowerCase(), {
                id: resident._id.toString(),
                name: fullName,
                status: resident.type === 'PastResident' ? 'Inactive' : 'Active',
                moveInDate: resident.residencyDetails?.moveInDate,
                moveOutDate: resident.residencyDetails?.moveOutDate
            });
        });

        // Read and parse CSV
        const csvFile = path.join(__dirname, 'payments.csv');
        const csvData = fs.readFileSync(csvFile, 'utf-8');
        const records = csv.parse(csvData, {
            columns: true,
            skip_empty_lines: true
        });

        // Group payments by resident
        const residentPayments = {};
        records.forEach(record => {
            if (shouldIncludePayment(record)) {
                const residentName = record['Resdent Name'].trim();
                if (!residentPayments[residentName]) {
                    residentPayments[residentName] = [];
                }
                residentPayments[residentName].push(record);
            }
        });

        // Process payments
        const payments = [];
        const unmatchedResidents = new Set();

        Object.entries(residentPayments).forEach(([residentName, residentRecords]) => {
            // Check if resident exists in database
            const resident = residentMap.get(residentName.toLowerCase());
            if (!resident) {
                unmatchedResidents.add(residentName);
                return;
            }

            // Sort records by date
            residentRecords.sort((a, b) => {
                const dateA = a['Date Rent Received'] ? new Date(parseDate(a['Date Rent Received'])) : new Date(0);
                const dateB = b['Date Rent Received'] ? new Date(parseDate(b['Date Rent Received'])) : new Date(0);
                return dateA - dateB;
            });

            // Process each record
            residentRecords.forEach((record, index) => {
                const amount = parseCurrency(record['Amount Received']);
                const date = parseDate(record['Date Rent Received']);
                const periodEnd = parseDate(record['Fee Paid Until Date']);
                
                let periodStart;
                if (index === 0) {
                    periodStart = date;
                } else {
                    const prevPayment = residentRecords[index - 1];
                    const prevPeriodEnd = parseDate(prevPayment['Fee Paid Until Date']);
                    periodStart = prevPeriodEnd || date;
                }

                const isPastDue = record['Fee Paid Until Date'] === 'Past Due';
                const balance = isPastDue ? extractBalance(record['Comments']) : 0;
                
                const payment = {
                    residentId: resident.id,
                    residentName: resident.name,
                    amount: amount,
                    date: date,
                    periodStart: periodStart,
                    periodEnd: periodEnd || date,
                    method: determinePaymentMethod(record['Receipt No.']),
                    notes: processNotes(record),
                    balance: balance,
                    status: resident.status
                };

                if (record['Comments'] && record['Comments'].includes('Ark Sponsored')) {
                    payment.amount = 0;
                    payment.method = 'Sponsored';
                    payment.balance = 0;
                }

                if (payment.date) {
                    payments.push(payment);
                }
            });
        });

        // Sort all payments by date
        payments.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Write to JSON file
        const jsonFile = path.join(__dirname, 'converted-payments.json');
        fs.writeFileSync(jsonFile, JSON.stringify(payments, null, 2));

        // Print summary
        console.log(`\nConverted ${payments.length} payments to ${jsonFile}`);
        
        // Print payments by resident status
        const activePayments = payments.filter(p => p.status === 'Active').length;
        const inactivePayments = payments.filter(p => p.status === 'Inactive').length;
        console.log('\nPayment Status Summary:');
        console.log(`Active Residents: ${activePayments} payments`);
        console.log(`Past Residents: ${inactivePayments} payments`);

        // Print unmatched residents
        if (unmatchedResidents.size > 0) {
            console.log('\nWarning: The following residents were not found in the database:');
            unmatchedResidents.forEach(name => console.log(`- ${name}`));
        }

        // Print payments by resident
        console.log('\nPayments by resident:');
        const paymentsByResident = payments.reduce((acc, payment) => {
            const key = `${payment.residentName} (${payment.status})`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        Object.entries(paymentsByResident)
            .sort((a, b) => b[1] - a[1])
            .forEach(([resident, count]) => {
                console.log(`${resident}: ${count} payments`);
            });

    } catch (error) {
        console.error('Error processing payments:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('\nDisconnected from MongoDB');
        }
    }
}

// Run the script
processPayments().catch(console.error); 