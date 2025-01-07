# Ark Contact Management System

A comprehensive contact management system built for managing residents, donors, volunteers, and other contacts. The system includes features for tracking program fee payments, resident status, and contact relationships.

## Features

### Contact Management
- Multiple contact types:
  - Residents (Current, Pipeline, Past, Declined)
  - Mentors
  - Sponsors
  - Volunteers
  - Donors
  - Board Members
  - Referral Sources
  - Partners
- Contact details tracking:
  - Personal information
  - Contact information
  - Organization details
  - Emergency contacts
  - Notes and comments

### Resident Management
- Track resident status (Active/Inactive)
- Manage residency details:
  - Move-in dates
  - Program fee payments
  - Program balance
  - Discipleship assignments
- Convert pipeline residents to active residents
- Mark declined residents

### Payment Ledger
- Record and track program fee payments
- View payment history by resident
- Monitor overdue payments
- Track payment methods:
  - Cash
  - Check
  - Credit Card
  - Bank Transfer
  - Money Order
- Payment period tracking
- Balance management

### User Interface
- Modern Material Design interface
- Responsive layout
- Dynamic navigation
- Sortable contact lists
- Filterable views
- Search functionality
- Pagination

## Technical Stack

### Frontend
- AngularJS
- Material Design Lite (MDL)
- HTML5/CSS3
- JavaScript (ES6+)

### Backend
- Node.js
- Express.js
- MongoDB

### Database Structure
- Collections:
  - contacts
  - payments

### API Endpoints

#### Contacts
- GET `/api/contacts` - Get all contacts
- POST `/api/contacts` - Create new contact
- PUT `/api/contacts/:id` - Update contact
- GET `/api/contacts/:id` - Get specific contact

#### Payments
- GET `/api/payments` - Get all payments
- GET `/api/payments/resident/:residentId` - Get resident payments
- POST `/api/payments` - Record new payment

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure MongoDB:
   - Create a MongoDB database
   - Update connection string in `server.js`

3. Start the server:
   ```bash
   npm start
   ```

4. Access the application:
   ```
   http://localhost:3000
   ```

## Database Indexes

### Contacts Collection
- Basic indexes:
  - `type`
  - `status`
  - `createdAt`
- Name search:
  - `firstName`, `lastName`
  - `organization.name`
- Compound indexes:
  - `type` + `status`
  - `type` + `createdAt`
- Resident-specific:
  - `residencyDetails.programFeesPaidUntil`
  - `residencyDetails.moveInDate`
- Text search:
  - `firstName`, `lastName`, `organization.name`, `contact.email`, `notes`

### Payments Collection
- Basic indexes:
  - `residentId`
  - `date`
  - `createdAt`
- Period indexes:
  - `periodStart`
  - `periodEnd`
- Compound indexes:
  - `residentId` + `date`
  - `residentId` + `periodEnd`
- Additional indexes:
  - `method`
  - `amount`
  - `residentId` + `balance`

## Project Structure

```
ark-crm/
├── public/
│   ├── js/
│   │   ├── controllers/
│   │   │   ├── mainController.js
│   │   │   └── paymentController.js
│   │   └── services/
│   │       └── contactService.js
│   ├── views/
│   │   ├── dashboard.html
│   │   └── ledger.html
│   ├── css/
│   │   └── styles.css
│   └── index.html
├── server.js
├── package.json
└── README.md
```

## Development

### Adding New Features
1. Create necessary database schema updates
2. Add required API endpoints
3. Implement frontend controllers and services
4. Update UI components
5. Add appropriate indexes for new queries

### Code Style
- Follow Angular 1.x best practices
- Use ES6+ features where supported
- Maintain consistent indentation
- Add comments for complex logic
- Use meaningful variable names

## License
This project is proprietary and confidential.

## Support
For support, please contact the development team. 