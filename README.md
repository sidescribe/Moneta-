# My Money - Personal Accounting App

A simple, local-first accounting app for managing personal finances and single-member LLC transactions.

## Features

- **Dashboard**: View account balances and monthly business metrics
- **Transaction Management**: Add, edit, and delete transactions with full categorization
- **Business vs Personal Tracking**: Separate personal and business transactions
- **Export Functionality**:
  - Export transactions as CSV
  - Export all data (accounts, categories, transactions) as JSON
- **Local Storage**: All data is stored locally in your browser
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Navigate to the project directory:
   ```bash
   cd moneta
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The app will open in your browser at `http://localhost:3000`.

### Building for Production

To build the app for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage

### Adding Transactions

1. Click the "+" button or "Add Transaction" button
2. Fill in the transaction details:
   - Select an account (Personal Checking, LLC Checking, or Credit Card)
   - Choose the date
   - Enter the amount (positive for income, negative for expenses)
   - Select income/expense type
   - Choose a category
   - Add description and optional notes

### Editing Transactions

1. In the Transactions view, click the edit icon (pencil) next to any transaction
2. Modify the transaction details in the modal
3. Click "Update Transaction" to save changes

### Deleting Transactions

1. In the Transactions view, click the delete icon (trash) next to any transaction
2. Confirm the deletion in the dialog

### Exporting Data

Two export options are available in the header:

1. **Export CSV**: Exports transactions as a CSV file with columns for Date, Account, Description, Category, Amount, Type, and Notes
2. **Export All**: Exports all application data (accounts, categories, transactions) as a JSON file for backup or migration

## Data Storage

All data is stored locally in your browser's localStorage. This means:
- Data persists between sessions
- No internet connection required after initial load
- Data is private and stored only on your device

## Categories

The app includes pre-configured categories for both business and personal transactions:

### Business Categories
- Owner Contribution (Income)
- Revenue (Income)
- Software/SaaS (Expense)
- Hosting (Expense)
- Marketing (Expense)
- Office Supplies (Expense)
- Travel (Expense)
- Meals & Entertainment (Expense)
- Professional Services (Expense)
- Taxes & Licenses (Expense)

### Personal Categories
- Salary (Income)
- Groceries (Expense)
- Rent/Mortgage (Expense)
- Utilities (Expense)
- Transportation (Expense)
- Healthcare (Expense)
- Entertainment (Expense)

## Default Accounts

- Personal Checking (Personal)
- LLC Checking (Business)
- Credit Card (Personal)

## Technology Stack

- **React**: Frontend framework
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **Webpack**: Build tool
- **Babel**: JavaScript transpiler
- **LocalStorage**: Data persistence