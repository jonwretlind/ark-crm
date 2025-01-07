const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'ark_crm';

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promise wrapper for readline question
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function importPayments(jsonFilePath) {
    let client;
    try {
        // Read and parse the JSON file
        const rawData = fs.readFileSync(jsonFilePath);
        const payments = JSON.parse(rawData);

        // Connect to MongoDB
        client = await MongoClient.connect(mongoUrl);
        const db = client.db(dbName);
        console.log('Connected to MongoDB');

        // Check for existing payments
        const existingCount = await db.collection('payments').countDocuments();
        if (existingCount > 0) {
            const answer = await askQuestion(`Found ${existingCount} existing payment records. Would you like to purge them before importing? (y/n): `);
            if (answer.toLowerCase() === 'y') {
                console.log('Purging existing payments...');
                await db.collection('payments').deleteMany({});
                console.log(`Purged ${existingCount} payment records`);
            } else {
                console.log('Keeping existing payment records');
            }
        }

        // Get all residents (current and past)
        const residents = await db.collection('contacts')
            .find({ 
                type: { 
                    $in: ['Resident', 'PastResident'] 
                }
            })
            .toArray();

        console.log(`Found ${residents.length} residents in database`);

        // Create resident map for validation
        const residentMap = new Map();
        const residentNameMap = new Map();
        
        residents.forEach(r => {
            const fullName = `${r.firstName} ${r.lastName}`;
            const id = r._id.toString();
            
            // Map by ID
            residentMap.set(id, {
                id: id,
                name: fullName,
                type: r.type,
                status: r.status,
                residencyDetails: r.residencyDetails || {}
            });
            
            // Map by name (case insensitive)
            residentNameMap.set(fullName.toLowerCase(), {
                id: id,
                name: fullName,
                type: r.type,
                status: r.status,
                residencyDetails: r.residencyDetails || {}
            });
        });

        // Process each payment
        const processedPayments = [];
        const errors = [];
        const updates = new Map(); // Track latest payment per resident

        for (const payment of payments) {
            try {
                // Try to find resident by ID first, then by name
                let resident = residentMap.get(payment.residentId);
                if (!resident) {
                    resident = residentNameMap.get(payment.residentName.toLowerCase());
                }
                
                if (!resident) {
                    throw new Error(`Resident not found: ${payment.residentName} (ID: ${payment.residentId})`);
                }

                // Create payment object with proper date formatting and default balance
                const processedPayment = {
                    residentId: resident.id, // Use the correct ID from our database
                    residentName: resident.name, // Use the correct name from our database
                    amount: parseFloat(payment.amount) || 0,
                    date: new Date(payment.date),
                    periodStart: new Date(payment.periodStart),
                    periodEnd: new Date(payment.periodEnd),
                    method: payment.method,
                    notes: payment.notes || '',
                    programFee: 850, // Default program fee
                    status: payment.status || (resident.type === 'PastResident' ? 'Inactive' : 'Active'),
                    createdAt: new Date()
                };

                // Calculate balance (Program Fee - Payment Amount)
                processedPayment.balance = processedPayment.programFee - processedPayment.amount;

                // Validate dates
                const dateFields = ['date', 'periodStart', 'periodEnd'];
                for (const field of dateFields) {
                    if (!(processedPayment[field] instanceof Date) || isNaN(processedPayment[field].getTime())) {
                        throw new Error(`Invalid ${field} for ${payment.residentName}`);
                    }
                }

                // Validate amount
                if (isNaN(processedPayment.amount)) {
                    throw new Error(`Invalid amount for ${payment.residentName}`);
                }

                // Validate method
                const validMethods = ['Cash', 'Check', 'Credit Card', 'Bank Transfer', 'Money Order', 'Sponsored', 'Pending'];
                if (!validMethods.includes(processedPayment.method)) {
                    throw new Error(`Invalid payment method for ${payment.residentName}: ${payment.method}`);
                }

                // Add to processed payments - removed redundant validation
                processedPayments.push(processedPayment);

                // Track latest payment for resident updates
                const currentUpdate = updates.get(resident.id);
                if (!currentUpdate || processedPayment.periodEnd > currentUpdate.periodEnd) {
                    updates.set(resident.id, {
                        periodEnd: processedPayment.periodEnd,
                        balance: processedPayment.balance
                    });
                }
            } catch (error) {
                errors.push({
                    payment: payment,
                    error: error.message
                });
            }
        }

        // Report validation results
        console.log(`\nValidation Results:`);
        console.log(`Total payments in file: ${payments.length}`);
        console.log(`Valid payments: ${processedPayments.length}`);
        console.log(`Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.log('\nValidation Errors:');
            errors.forEach(({ payment, error }) => {
                console.log(`- ${error} (${JSON.stringify(payment)})`);
            });
        }

        // Confirm import
        if (processedPayments.length > 0) {
            console.log('\nReady to import payments. Press Ctrl+C to cancel or wait 5 seconds to continue...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // First, update the payments collection schema to be less strict
            try {
                await db.command({
                    collMod: 'payments',
                    validator: {
                        $jsonSchema: {
                            bsonType: 'object',
                            required: ['residentId', 'residentName', 'amount', 'date', 'periodStart', 'periodEnd', 'method', 'programFee', 'balance'],
                            properties: {
                                residentId: { bsonType: 'string' },
                                residentName: { bsonType: 'string' },
                                amount: { bsonType: 'number' },
                                date: { bsonType: 'date' },
                                periodStart: { bsonType: 'date' },
                                periodEnd: { bsonType: 'date' },
                                method: { 
                                    bsonType: 'string',
                                    enum: ['Cash', 'Check', 'Credit Card', 'Bank Transfer', 'Money Order', 'Sponsored', 'Pending']
                                },
                                notes: { bsonType: 'string' },
                                programFee: { bsonType: 'number' },
                                balance: { bsonType: 'number' },
                                status: { bsonType: 'string' },
                                createdAt: { bsonType: 'date' }
                            }
                        }
                    },
                    validationLevel: 'moderate'
                });
                console.log('Updated payments collection schema');
            } catch (schemaError) {
                console.error('Error updating schema:', schemaError);
                return;
            }

            // Insert all payments at once since we've already validated them
            try {
                const result = await db.collection('payments').insertMany(processedPayments);
                console.log(`\nSuccessfully imported ${result.insertedCount} payments`);
            } catch (insertError) {
                console.error('Error importing payments:', insertError);
                return;
            }

            // Update resident program fees
            console.log('\nUpdating resident program fees...');
            for (const [residentId, update] of updates) {
                try {
                    await db.collection('contacts').updateOne(
                        { _id: new ObjectId(residentId) },
                        {
                            $set: {
                                'residencyDetails.programFeesPaidUntil': update.periodEnd,
                                'residencyDetails.programBalance': update.balance,
                                'residencyDetails.lastPaymentDate': new Date()
                            }
                        }
                    );
                    console.log(`Updated program fees for resident: ${residentMap.get(residentId).name}`);
                } catch (updateError) {
                    console.error(`Error updating resident ${residentId}:`, updateError);
                }
            }

            // Print summary by status
            const activePayments = processedPayments.filter(p => p.status === 'Active').length;
            const inactivePayments = processedPayments.filter(p => p.status === 'Inactive').length;
            console.log('\nImported Payments Summary:');
            console.log(`Active Residents: ${activePayments} payments`);
            console.log(`Past Residents: ${inactivePayments} payments`);
        }

    } catch (error) {
        console.error('Import error:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('\nDisconnected from MongoDB');
        }
        rl.close();
    }
}

// Check if file path is provided
if (process.argv.length < 3) {
    console.log('Usage: node import-payments.js <path-to-json-file>');
    process.exit(1);
}

// Get file path from command line argument
const jsonFilePath = path.resolve(process.argv[2]);

// Check if file exists
if (!fs.existsSync(jsonFilePath)) {
    console.error(`File not found: ${jsonFilePath}`);
    process.exit(1);
}

// Run the import
importPayments(jsonFilePath); 