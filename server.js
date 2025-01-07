const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'ark_crm';

app.use(express.static(__dirname));
app.use(express.json());

// Connect to MongoDB
let db;
async function connectDB() {
    try {
        // Remove deprecated options
        const client = await MongoClient.connect(mongoUrl);
        db = client.db(dbName);
        console.log('Connected to MongoDB');
        
        // Create indexes for the contacts collection
        console.log('Creating indexes for contacts collection...');
        
        // First, get existing indexes
        const existingIndexes = await db.collection('contacts').listIndexes().toArray();
        console.log('Existing indexes:', existingIndexes.map(idx => idx.name));

        // Drop existing text index if it exists
        const textIndex = existingIndexes.find(idx => idx.textIndexVersion);
        if (textIndex) {
            console.log('Dropping existing text index:', textIndex.name);
            await db.collection('contacts').dropIndex(textIndex.name);
        }

        // Create new indexes, avoiding duplicates
        const indexOperations = [
            // Basic indexes
            { key: { type: 1 }, name: 'type_1' },
            { key: { status: 1 }, name: 'status_1' },
            { key: { createdAt: -1 }, name: 'createdAt_-1' },
            
            // Name search indexes
            { key: { firstName: 1, lastName: 1 }, name: 'name_1' },
            { key: { 'organization.name': 1 }, name: 'org_name_1' },
            
            // Compound indexes
            { key: { type: 1, status: 1 }, name: 'type_status_1' },
            { key: { type: 1, createdAt: -1 }, name: 'type_created_1' },
            
            // Resident-specific indexes
            { key: { 'residencyDetails.programFeesPaidUntil': 1 }, name: 'program_fees_1' },
            { key: { 'residencyDetails.moveInDate': 1 }, name: 'move_in_1' },
            { key: { type: 1, 'residencyDetails.programFeesPaidUntil': 1 }, name: 'type_fees_1' }
        ];

        // Create text index separately
        const textIndexSpec = {
            firstName: 'text',
            lastName: 'text',
            'organization.name': 'text',
            'contact.email': 'text',
            'contact.phone': 'text',
            notes: 'text'
        };

        // Create indexes one by one to handle errors gracefully
        for (const indexSpec of indexOperations) {
            try {
                const indexExists = existingIndexes.some(idx => 
                    JSON.stringify(idx.key) === JSON.stringify(indexSpec.key));
                
                if (!indexExists) {
                    await db.collection('contacts').createIndex(indexSpec.key, { name: indexSpec.name });
                    console.log(`Created index: ${indexSpec.name}`);
                } else {
                    console.log(`Index already exists: ${indexSpec.name}`);
                }
            } catch (indexError) {
                console.warn(`Warning: Could not create index ${indexSpec.name}:`, indexError);
            }
        }

        // Create text index
        try {
            await db.collection('contacts').createIndex(textIndexSpec, {
                name: 'contact_text_search',
                weights: {
                    firstName: 2,
                    lastName: 2,
                    'organization.name': 1,
                    'contact.email': 1,
                    'contact.phone': 1,
                    notes: 1
                }
            });
            console.log('Created text search index');
        } catch (textIndexError) {
            console.warn('Warning: Could not create text search index:', textIndexError);
        }

        // Create indexes for payments collection
        console.log('Creating indexes for payments collection...');
        const paymentIndexes = [
            { key: { residentId: 1 }, name: 'resident_1' },
            { key: { date: -1 }, name: 'date_-1' },
            { key: { createdAt: -1 }, name: 'created_-1' },
            { key: { periodStart: 1 }, name: 'period_start_1' },
            { key: { periodEnd: 1 }, name: 'period_end_1' },
            { key: { residentId: 1, date: -1 }, name: 'resident_date_1' },
            { key: { residentId: 1, periodEnd: -1 }, name: 'resident_period_1' },
            { key: { method: 1 }, name: 'method_1' },
            { key: { amount: 1 }, name: 'amount_1' },
            { key: { residentId: 1, balance: 1 }, name: 'resident_balance_1' }
        ];

        const existingPaymentIndexes = await db.collection('payments').listIndexes().toArray();
        
        for (const indexSpec of paymentIndexes) {
            try {
                const indexExists = existingPaymentIndexes.some(idx => 
                    JSON.stringify(idx.key) === JSON.stringify(indexSpec.key));
                
                if (!indexExists) {
                    await db.collection('payments').createIndex(indexSpec.key, { name: indexSpec.name });
                    console.log(`Created payment index: ${indexSpec.name}`);
                } else {
                    console.log(`Payment index already exists: ${indexSpec.name}`);
                }
            } catch (indexError) {
                console.warn(`Warning: Could not create payment index ${indexSpec.name}:`, indexError);
            }
        }

        // Verify connection by checking collection
        const collections = await db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));
        
        // Check contacts collection
        const count = await db.collection('contacts').countDocuments();
        console.log('Total contacts in database:', count);
        
        // Create indexes for the payments collection
        await db.collection('payments').createIndex({ residentId: 1 });
        await db.collection('payments').createIndex({ date: -1 });
        await db.collection('payments').createIndex({ periodEnd: 1 });
        await db.collection('payments').createIndex({ 'residencyDetails.programFeesPaidUntil': 1 });

        // Check if payments collection exists
        const hasPayments = collections.some(c => c.name === 'payments');
        if (!hasPayments) {
            // Create payments collection only if it doesn't exist
            await db.createCollection('payments', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['residentId', 'residentName', 'amount', 'date', 'periodStart', 'periodEnd', 'method'],
                        properties: {
                            residentId: {
                                bsonType: 'string',
                                description: 'ID of the resident making the payment'
                            },
                            residentName: {
                                bsonType: 'string',
                                description: 'Name of the resident for display purposes'
                            },
                            amount: {
                                bsonType: 'number',
                                description: 'Payment amount'
                            },
                            date: {
                                bsonType: 'date',
                                description: 'Date payment was made'
                            },
                            periodStart: {
                                bsonType: 'date',
                                description: 'Start date of the payment period'
                            },
                            periodEnd: {
                                bsonType: 'date',
                                description: 'End date of the payment period'
                            },
                            method: {
                                bsonType: 'string',
                                enum: ['Cash', 'Check', 'Credit Card', 'Bank Transfer', 'Money Order'],
                                description: 'Payment method used'
                            },
                            notes: {
                                bsonType: 'string',
                                description: 'Optional notes about the payment'
                            },
                            balance: {
                                bsonType: 'number',
                                description: 'Remaining balance after payment'
                            },
                            createdAt: {
                                bsonType: 'date',
                                description: 'Timestamp of when the payment was recorded'
                            }
                        }
                    }
                }
            });
            console.log('Created payments collection');
        } else {
            // Update existing payments collection schema
            try {
                await db.command({
                    collMod: 'payments',
                    validator: {
                        $jsonSchema: {
                            bsonType: 'object',
                            required: ['residentId', 'residentName', 'amount', 'date', 'periodStart', 'periodEnd', 'method'],
                            properties: {
                                residentId: {
                                    bsonType: 'string',
                                    description: 'ID of the resident making the payment'
                                },
                                residentName: {
                                    bsonType: 'string',
                                    description: 'Name of the resident for display purposes'
                                },
                                amount: {
                                    bsonType: 'number',
                                    description: 'Payment amount'
                                },
                                date: {
                                    bsonType: 'date',
                                    description: 'Date payment was made'
                                },
                                periodStart: {
                                    bsonType: 'date',
                                    description: 'Start date of the payment period'
                                },
                                periodEnd: {
                                    bsonType: 'date',
                                    description: 'End date of the payment period'
                                },
                                method: {
                                    bsonType: 'string',
                                    enum: ['Cash', 'Check', 'Credit Card', 'Bank Transfer', 'Money Order'],
                                    description: 'Payment method used'
                                },
                                notes: {
                                    bsonType: 'string',
                                    description: 'Optional notes about the payment'
                                },
                                balance: {
                                    bsonType: 'number',
                                    description: 'Remaining balance after payment'
                                },
                                createdAt: {
                                    bsonType: 'date',
                                    description: 'Timestamp of when the payment was recorded'
                                }
                            }
                        }
                    },
                    validationLevel: "moderate"
                });
                console.log('Updated payments collection schema');
            } catch (schemaError) {
                console.warn('Warning: Could not update payments collection schema:', schemaError);
            }
        }

        // Update contacts collection schema
        try {
            await db.command({
                collMod: 'contacts',
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['firstName', 'lastName', 'type', 'status'],
                        properties: {
                            firstName: { bsonType: 'string' },
                            lastName: { bsonType: 'string' },
                            type: { 
                                bsonType: 'string',
                                enum: [
                                    'Resident',
                                    'ResidentPipeline',
                                    'PastResident',
                                    'DeclinedResident',
                                    'Mentor',
                                    'Sponsor',
                                    'Volunteer',
                                    'Donor',
                                    'Board',
                                    'ReferralSource',
                                    'Partner'
                                ]
                            },
                            status: {
                                bsonType: 'string',
                                enum: ['Active', 'Inactive']
                            },
                            residencyDetails: {
                                bsonType: 'object',
                                properties: {
                                    moveInDate: { bsonType: 'date' },
                                    programFeesPaidUntil: { bsonType: 'date' },
                                    programBalance: { bsonType: 'number' },
                                    programFee: { bsonType: 'number' },
                                    discipler: { bsonType: 'string' },
                                    comments: { bsonType: 'string' }
                                }
                            },
                            contact: {
                                bsonType: 'object',
                                properties: {
                                    email: { bsonType: 'string' },
                                    phone: { bsonType: 'string' },
                                    address: { bsonType: 'string' }
                                }
                            },
                            organization: {
                                bsonType: 'object',
                                properties: {
                                    name: { bsonType: 'string' },
                                    role: { bsonType: 'string' }
                                }
                            },
                            emergencyContact: {
                                bsonType: 'object',
                                properties: {
                                    name: { bsonType: 'string' },
                                    relationship: { bsonType: 'string' },
                                    phone: { bsonType: 'string' }
                                }
                            },
                            notes: { bsonType: 'string' },
                            createdAt: { bsonType: 'date' }
                        }
                    }
                },
                validationLevel: "moderate"
            });
            console.log('Updated contacts collection schema');
        } catch (schemaError) {
            console.warn('Warning: Could not update contacts collection schema:', schemaError);
        }

        // After all schema and index creation, sync payments
        await syncPaymentsWithResidents();

        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        return false;
    }
}

// Function to sync payments with resident details
async function syncPaymentsWithResidents() {
    try {
        console.log('Starting payment ledger synchronization...');
        
        // Get all residents
        const residents = await db.collection('contacts')
            .find({ 
                type: 'Resident',
                'residencyDetails.programFeesPaidUntil': { $exists: true }
            })
            .toArray();

        console.log(`Found ${residents.length} residents to sync`);

        for (const resident of residents) {
            try {
                // Get all payments for this resident, ordered by date
                const payments = await db.collection('payments')
                    .find({ residentId: resident._id.toString() })
                    .sort({ date: 1 })
                    .toArray();

                const residentName = `${resident.firstName} ${resident.lastName}`;
                const programFee = resident.residencyDetails?.programFee || 850;
                
                // Ensure dates are valid
                const programFeesPaidUntil = resident.residencyDetails.programFeesPaidUntil ? 
                    new Date(resident.residencyDetails.programFeesPaidUntil) : null;
                const moveInDate = resident.residencyDetails.moveInDate ? 
                    new Date(resident.residencyDetails.moveInDate) : null;

                // Skip if no valid programFeesPaidUntil date
                if (!programFeesPaidUntil || isNaN(programFeesPaidUntil.getTime())) {
                    console.log(`Skipping ${residentName}: Invalid programFeesPaidUntil date`);
                    continue;
                }

                // If there's no payment record but resident has programFeesPaidUntil, create one
                if (payments.length === 0 && programFeesPaidUntil) {
                    const periodStart = moveInDate && !isNaN(moveInDate.getTime()) ? 
                        moveInDate : programFeesPaidUntil;

                    const newPayment = {
                        residentId: resident._id.toString(),
                        residentName: residentName,
                        amount: 0, // Historical record
                        date: programFeesPaidUntil,
                        periodStart: periodStart,
                        periodEnd: programFeesPaidUntil,
                        method: 'System Sync',
                        notes: 'Auto-generated from resident details during system sync',
                        programFee: programFee,
                        balance: programFee, // Initial balance is the program fee
                        createdAt: new Date()
                    };

                    // Validate the payment object before insertion
                    if (!validatePayment(newPayment)) {
                        console.log(`Skipping ${residentName}: Invalid payment data`);
                        continue;
                    }

                    await db.collection('payments').insertOne(newPayment);
                    console.log(`Created initial payment record for ${residentName}`);
                }
                // If latest payment doesn't match resident details, update payment
                else if (payments.length > 0) {
                    const latestPayment = payments[payments.length - 1];
                    const paymentPeriodEnd = new Date(latestPayment.periodEnd);

                    if (programFeesPaidUntil.getTime() !== paymentPeriodEnd.getTime()) {
                        const updatePayment = {
                            residentId: resident._id.toString(),
                            residentName: residentName,
                            amount: 0, // Historical record
                            date: programFeesPaidUntil,
                            periodStart: paymentPeriodEnd,
                            periodEnd: programFeesPaidUntil,
                            method: 'System Sync',
                            notes: 'Auto-generated during system sync to match resident details',
                            programFee: programFee,
                            balance: latestPayment.balance + programFee, // Add program fee to previous balance
                            createdAt: new Date()
                        };

                        // Validate the payment object before insertion
                        if (!validatePayment(updatePayment)) {
                            console.log(`Skipping ${residentName}: Invalid payment data`);
                            continue;
                        }

                        await db.collection('payments').insertOne(updatePayment);
                        console.log(`Updated payment record for ${residentName}`);
                    }
                }
            } catch (residentError) {
                console.error(`Error processing resident ${resident._id}:`, residentError);
                continue; // Continue with next resident even if one fails
            }
        }

        console.log('Payment ledger synchronization completed');
    } catch (error) {
        console.error('Error syncing payments with residents:', error);
    }
}

// Helper function to validate payment object
function validatePayment(payment) {
    // Check required fields
    const requiredFields = ['residentId', 'residentName', 'amount', 'date', 'periodStart', 'periodEnd', 'method', 'programFee', 'balance'];
    for (const field of requiredFields) {
        if (!payment[field]) {
            console.log(`Missing required field: ${field}`);
            return false;
        }
    }

    // Validate dates
    const dateFields = ['date', 'periodStart', 'periodEnd', 'createdAt'];
    for (const field of dateFields) {
        if (!(payment[field] instanceof Date) || isNaN(payment[field].getTime())) {
            console.log(`Invalid date for field: ${field}`);
            return false;
        }
    }

    // Validate method is in allowed values
    const allowedMethods = ['Cash', 'Check', 'Credit Card', 'Bank Transfer', 'Money Order', 'System Sync'];
    if (!allowedMethods.includes(payment.method)) {
        console.log(`Invalid payment method: ${payment.method}`);
        return false;
    }

    // Validate numeric fields
    if (typeof payment.amount !== 'number' || 
        typeof payment.balance !== 'number' || 
        typeof payment.programFee !== 'number') {
        console.log('Amount, balance, and programFee must be numbers');
        return false;
    }

    return true;
}

// API endpoint to get contacts
app.get('/api/contacts', async (req, res) => {
    try {
        if (!db) {
            throw new Error('Database connection not established');
        }

        const contacts = await db.collection('contacts')
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to update a contact
app.put('/api/contacts/:id', async (req, res) => {
    try {
        if (!db) {
            throw new Error('Database connection not established');
        }

        const { id } = req.params;
        const updatedContact = req.body;
        delete updatedContact._id; // Remove _id from update operation

        // Ensure programFee has a value for resident types
        if (['Resident', 'ResidentPipeline'].includes(updatedContact.type)) {
            if (!updatedContact.residencyDetails) {
                updatedContact.residencyDetails = {};
            }
            updatedContact.residencyDetails.programFee = updatedContact.residencyDetails.programFee || 850;
        }

        const result = await db.collection('contacts').updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedContact }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        // If this is a resident and residencyDetails were updated, sync payments
        if (updatedContact.type === 'Resident' && updatedContact.residencyDetails) {
            const residentName = `${updatedContact.firstName} ${updatedContact.lastName}`;
            
            // Get the latest payment
            const latestPayment = await db.collection('payments')
                .find({ residentId: id })
                .sort({ periodEnd: -1 })
                .limit(1)
                .toArray();

            // Create or update payment record if needed
            if (updatedContact.residencyDetails.programFeesPaidUntil) {
                const newPayment = {
                    residentId: id,
                    residentName: residentName,
                    amount: 0, // Historical record
                    date: new Date(updatedContact.residencyDetails.programFeesPaidUntil),
                    periodStart: latestPayment.length > 0 ? 
                        new Date(latestPayment[0].periodEnd) : 
                        new Date(updatedContact.residencyDetails.moveInDate || updatedContact.residencyDetails.programFeesPaidUntil),
                    periodEnd: new Date(updatedContact.residencyDetails.programFeesPaidUntil),
                    method: 'System Update',
                    notes: 'Auto-generated from resident details update',
                    balance: updatedContact.residencyDetails.programBalance || 0,
                    createdAt: new Date()
                };

                await db.collection('payments').insertOne(newPayment);
            }
        }

        res.json({ message: 'Contact updated successfully' });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to create a new contact
app.post('/api/contacts', async (req, res) => {
    try {
        if (!db) {
            throw new Error('Database connection not established');
        }

        const newContact = {
            ...req.body,
            createdAt: new Date(),
            status: req.body.status || 'Active'
        };

        // Set default programFee for resident types
        if (['Resident', 'ResidentPipeline'].includes(newContact.type)) {
            if (!newContact.residencyDetails) {
                newContact.residencyDetails = {};
            }
            newContact.residencyDetails.programFee = newContact.residencyDetails.programFee || 850;
        }

        const result = await db.collection('contacts').insertOne(newContact);
        
        if (!result.insertedId) {
            throw new Error('Failed to create contact');
        }

        res.status(201).json({
            message: 'Contact created successfully',
            contact: { ...newContact, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get all payments
app.get('/api/payments', async (req, res) => {
    try {
        if (!db) {
            throw new Error('Database connection not established');
        }

        const payments = await db.collection('payments')
            .find({})
            .sort({ date: -1 })
            .toArray();

        res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get payments for a specific resident
app.get('/api/payments/resident/:residentId', async (req, res) => {
    try {
        if (!db) {
            throw new Error('Database connection not established');
        }

        const { residentId } = req.params;
        const payments = await db.collection('payments')
            .find({ residentId: residentId })
            .sort({ date: -1 })
            .toArray();

        res.json(payments);
    } catch (error) {
        console.error('Error fetching resident payments:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to record a new payment
app.post('/api/payments', async (req, res) => {
    try {
        if (!db) {
            throw new Error('Database connection not established');
        }

        // Get the resident to get their program fee
        const resident = await db.collection('contacts').findOne(
            { _id: new ObjectId(req.body.residentId) }
        );

        if (!resident) {
            throw new Error('Resident not found');
        }

        // Get the latest payment to get the previous balance
        const latestPayment = await db.collection('payments')
            .find({ residentId: req.body.residentId })
            .sort({ date: -1 })
            .limit(1)
            .toArray();

        // Calculate the new balance
        const programFee = resident.residencyDetails?.programFee || 850;
        const previousBalance = latestPayment.length > 0 ? latestPayment[0].balance : programFee;
        const newBalance = previousBalance + programFee - req.body.amount;

        const payment = {
            ...req.body,
            date: new Date(req.body.date),
            periodStart: new Date(req.body.periodStart),
            periodEnd: new Date(req.body.periodEnd),
            programFee: programFee,
            balance: newBalance,
            createdAt: new Date()
        };

        const result = await db.collection('payments').insertOne(payment);
        
        if (!result.insertedId) {
            throw new Error('Failed to record payment');
        }

        // Update resident's program fees paid until date and balance
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(payment.residentId) },
            { 
                $set: { 
                    'residencyDetails.programFeesPaidUntil': payment.periodEnd,
                    'residencyDetails.programBalance': payment.balance
                }
            }
        );

        res.status(201).json({
            message: 'Payment recorded successfully',
            payment: { ...payment, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add a diagnostic endpoint
app.get('/api/diagnostics', async (req, res) => {
    try {
        const collections = await db.listCollections().toArray();
        const contactsCollection = await db.collection('contacts').stats();
        res.json({
            collections: collections,
            contactsStats: contactsCollection
        });
    } catch (error) {
        console.error('Diagnostics error:', error);
        res.status(500).json({ error: 'Error running diagnostics' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await connectDB();
    console.log(`Server running on port ${PORT}`);
}); 