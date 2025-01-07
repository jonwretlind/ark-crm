class PaymentController {
    constructor(contactService) {
        this.contactService = contactService;
        this.initializeEventListeners();
        this.loadPayments();
    }

    initializeEventListeners() {
        const recordPaymentButton = document.querySelector('#recordPaymentButton');
        if (recordPaymentButton) {
            recordPaymentButton.addEventListener('click', () => this.showPaymentDialog());
        }

        // Event delegation for dynamic elements
        document.addEventListener('click', (event) => {
            if (event.target.matches('.view-resident-payments')) {
                const residentId = event.target.dataset.residentId;
                this.loadResidentPayments(residentId);
            }
        });
    }

    async loadPayments() {
        try {
            const payments = await this.contactService.getPayments();
            this.displayPayments(payments);
        } catch (error) {
            console.error('Error loading payments:', error);
            // TODO: Show error message to user
        }
    }

    async loadResidentPayments(residentId) {
        try {
            const payments = await this.contactService.getResidentPayments(residentId);
            this.displayPayments(payments, true);
        } catch (error) {
            console.error('Error loading resident payments:', error);
            // TODO: Show error message to user
        }
    }

    displayPayments(payments, isResidentView = false) {
        const paymentsContainer = document.querySelector('#paymentsContainer');
        if (!paymentsContainer) return;

        const tableHTML = `
            <table class="mdl-data-table mdl-js-data-table mdl-shadow--2dp" style="width: 100%;">
                <thead>
                    <tr>
                        <th class="mdl-data-table__cell--non-numeric">Date</th>
                        ${!isResidentView ? '<th class="mdl-data-table__cell--non-numeric">Resident</th>' : ''}
                        <th class="mdl-data-table__cell--non-numeric">Amount</th>
                        <th class="mdl-data-table__cell--non-numeric">Period</th>
                        <th class="mdl-data-table__cell--non-numeric">Method</th>
                        <th class="mdl-data-table__cell--non-numeric">Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(payment => `
                        <tr>
                            <td class="mdl-data-table__cell--non-numeric">${new Date(payment.date).toLocaleDateString()}</td>
                            ${!isResidentView ? `<td class="mdl-data-table__cell--non-numeric">${payment.residentName}</td>` : ''}
                            <td class="mdl-data-table__cell--non-numeric">$${payment.amount.toFixed(2)}</td>
                            <td class="mdl-data-table__cell--non-numeric">
                                ${new Date(payment.periodStart).toLocaleDateString()} - 
                                ${new Date(payment.periodEnd).toLocaleDateString()}
                            </td>
                            <td class="mdl-data-table__cell--non-numeric">${payment.method}</td>
                            <td class="mdl-data-table__cell--non-numeric">${payment.notes || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        paymentsContainer.innerHTML = tableHTML;
        componentHandler.upgradeElements(paymentsContainer);
    }

    showPaymentDialog() {
        const dialog = document.querySelector('#paymentDialog');
        if (!dialog) {
            console.error('Payment dialog not found');
            return;
        }

        if (!dialog.showModal) {
            dialogPolyfill.registerDialog(dialog);
        }

        // Reset form
        const form = dialog.querySelector('form');
        if (form) form.reset();

        dialog.showModal();

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.handlePaymentSubmission(form);
            dialog.close();
        };

        // Handle dialog close
        dialog.querySelector('.close').addEventListener('click', () => {
            dialog.close();
        });
    }

    async handlePaymentSubmission(form) {
        try {
            const formData = new FormData(form);
            const paymentData = {
                residentId: formData.get('residentId'),
                residentName: formData.get('residentName'),
                amount: parseFloat(formData.get('amount')),
                date: formData.get('date'),
                periodStart: formData.get('periodStart'),
                periodEnd: formData.get('periodEnd'),
                method: formData.get('method'),
                notes: formData.get('notes'),
                balance: parseFloat(formData.get('balance'))
            };

            await this.contactService.recordPayment(paymentData);
            await this.loadPayments(); // Refresh the payments list
        } catch (error) {
            console.error('Error submitting payment:', error);
            // TODO: Show error message to user
        }
    }
}

// Export the controller
window.PaymentController = PaymentController; 