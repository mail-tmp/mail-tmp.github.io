/**
 * TempMail - A disposable email service for developers
 * This class handles all the functionality for managing temporary email addresses
 */
class TempMail {
    constructor() {
        this.currentEmail = '';
        this.currentToken = '';
        this.emails = [];
        this.refreshInterval = null;
        this.apiBase = 'https://api.mail.tm';
        this.savedMailboxes = {};
        this.autoRefreshEnabled = true; // Enable auto-refresh by default
        this.refreshFrequency = 5000;   // 5 seconds refresh frequency

        this.loadSavedData();
        this.updateMailboxSelector();
        this.initializeTooltips();
        this.initializeAboutBanner();

        const lastUsed = this.getLastUsedMailbox();
        if (lastUsed && this.savedMailboxes[lastUsed]) {
            this.loadMailbox(lastUsed);
        } else {
            this.generateEmail();
        }
    }

    initializeTooltips() {
        try {
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipTriggerList.forEach(triggerEl => {
                if (!bootstrap.Tooltip.getInstance(triggerEl)) {
                    new bootstrap.Tooltip(triggerEl);
                }
            });
        } catch (error) {
            console.error('Error initializing tooltips:', error);
        }
    }

    initializeAboutBanner() {
        const headerSection = document.getElementById('headerSection');
        const aboutBanner = document.getElementById('aboutBanner');
        let isVisible = false;
        
        if (!headerSection || !aboutBanner) return;

        const showBanner = () => {
            aboutBanner.classList.remove('hidden');
            // Force a reflow before adding the visible class
            aboutBanner.offsetHeight;
            aboutBanner.classList.add('visible');
            isVisible = true;
        };

        const hideBanner = () => {
            aboutBanner.classList.remove('visible');
            isVisible = false;
            // Wait for transition to complete before hiding
            setTimeout(() => {
                if (!isVisible) {
                    aboutBanner.classList.add('hidden');
                }
            }, 300);
        };

        headerSection.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (aboutBanner.classList.contains('visible')) {
                hideBanner();
            } else {
                showBanner();
            }
        });

        // Close banner when clicking outside
        document.addEventListener('click', (event) => {
            if (isVisible && !aboutBanner.contains(event.target) && !headerSection.contains(event.target)) {
                hideBanner();
            }
        });

        // Handle keyboard accessibility
        headerSection.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (aboutBanner.classList.contains('visible')) {
                    hideBanner();
                } else {
                    showBanner();
                }
            } else if (e.key === 'Escape' && isVisible) {
                hideBanner();
            }
        });
    }

    async generateEmail() {
        try {
            const btn = document.querySelector('button[onclick="generateEmail()"]');
            this.showStatus(btn, 'Generating email...', 'info');

            const domainsResponse = await fetch(`${this.apiBase}/domains`, { method: 'GET' });
            if (!domainsResponse.ok) {
                throw new Error(`Failed to get domains: ${domainsResponse.status}`);
            }
            const domains = await domainsResponse.json();

            if (!domains['hydra:member'] || !Array.isArray(domains['hydra:member']) || domains['hydra:member'].length === 0) {
                throw new Error('No domains available');
            }

            const domain = domains['hydra:member'][0].domain;
            const username = this.generateRandomString(8);
            this.currentEmail = `${username}@${domain}`;

            const createResponse = await fetch(`${this.apiBase}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.currentEmail,
                    password: 'temppassword123'
                })
            });

            if (!createResponse.ok) {
                const errorData = await createResponse.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to create account: ${createResponse.status}`);
            }

            const authResponse = await fetch(`${this.apiBase}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.currentEmail,
                    password: 'temppassword123'
                })
            });

            if (!authResponse.ok) {
                throw new Error(`Failed to get authentication token: ${authResponse.status}`);
            }

            const authData = await authResponse.json();
            if (!authData.token) {
                throw new Error('No token received');
            }
            this.currentToken = authData.token;

            this.emails = [];
            this.updateEmailDisplay();
            this.updateEmailList();

            document.getElementById('currentEmailSection').classList.remove('hidden');
            document.getElementById('emailDisplay').innerHTML = `<span>${this.currentEmail}</span>`;
            document.getElementById('emailList').classList.remove('hidden');

            this.showStatus(btn, 'Email generated!', 'success');

            this.saveMailbox();
            this.updateMailboxSelector();
            this.initializeTooltips();

            if (typeof trackEmailGeneration === 'function') {
                trackEmailGeneration();
            }

            this.startAutoRefresh();

        } catch (error) {
            const btn = document.querySelector('button[onclick="generateEmail()"]');
            this.showStatus(btn, 'Error generating email', 'danger');
            console.error('Generate email error:', error.message);
        }
    }

    generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async checkEmails() {
        if (!this.currentEmail || !this.currentToken) {
            const btn = document.getElementById('refreshBtn');
            this.showStatus(btn, 'Generate an email first', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('refreshBtn');
            this.setRefreshButton(true);
            document.getElementById('refreshOverlay').classList.remove('hidden');

            if (typeof trackEmailCheck === 'function') {
                trackEmailCheck();
            }

            const response = await fetch(`${this.apiBase}/messages`, {
                headers: { 'Authorization': `Bearer ${this.currentToken}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            const messages = data['hydra:member'] || [];

            if (messages.length > 0) {
                const existingIds = new Set(this.emails.map(email => email.id));
                const newEmails = messages.filter(msg => msg.id && !existingIds.has(msg.id));

                if (newEmails.length > 0) {
                    this.emails = [...newEmails, ...this.emails];
                    this.showStatus(btn, `${newEmails.length} new email(s)!`, 'success');
                    this.updateEmailList();
                    this.saveMailbox();
                    this.updateMailboxSelector();
                } else {
                    this.showStatus(btn, 'No new emails', 'info');
                }
            } else {
                this.showStatus(btn, 'Inbox empty', 'info');
            }

        } catch (error) {
            const btn = document.getElementById('refreshBtn');
            this.showStatus(btn, 'Error checking emails', 'danger');
            console.error('Check emails error:', error.message);
        } finally {
            this.setRefreshButton(false);
            document.getElementById('refreshOverlay').classList.add('hidden');
            this.initializeTooltips();
        }
    }

    async getEmailContent(messageId) {
        try {
            if (!messageId) {
                throw new Error('No message ID provided');
            }

            const response = await fetch(`${this.apiBase}/messages/${messageId}`, {
                headers: { 'Authorization': `Bearer ${this.currentToken}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch message content: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Get email content error:', error.message);
            return null;
        }
    }

    showStatus(element, message, type = 'info') {
        const tooltip = bootstrap.Tooltip.getInstance(element);
        if (tooltip) {
            element.setAttribute('data-bs-original-title', message);
            tooltip.setContent({ '.tooltip-inner': message });
            tooltip.show();

            const tooltipElement = document.querySelector('.tooltip');
            if (tooltipElement) {
                tooltipElement.querySelector('.tooltip-inner').className = `tooltip-inner alert-${type}`;
            }

            setTimeout(() => tooltip.hide(), 3000);
        }
    }

    updateEmailList() {
        const emailsContainer = document.getElementById('emails');
        const emailCount = document.getElementById('emailCount');
        const emptyInbox = document.getElementById('emptyInbox');
        const clearAllBtn = document.querySelector('button[onclick="clearAllEmails()"]');

        emailCount.textContent = this.emails.length;

        if (this.emails.length === 0) {
            emailsContainer.innerHTML = '';
            emptyInbox.classList.remove('hidden');
            if (clearAllBtn) clearAllBtn.classList.add('hidden');
            return
        }

        emptyInbox.classList.add('hidden');
        if (clearAllBtn) clearAllBtn.classList.remove('hidden');
        
        emailsContainer.innerHTML = this.emails.map((email, index) => {
            return `
                <div class="bg-gray-900 border border-gray-600 rounded-lg p-4 mb-2 hover:bg-gray-800 transition cursor-pointer" 
                     onclick="tempMail.showEmailDetails('${email.id}')">
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-semibold text-gray-100">${this.escapeHtml(email.from?.address || 'Unknown Sender')}</div>
                        <div class="flex items-center gap-2">
                            <div class="text-sm text-gray-400">${this.formatDate(email.createdAt)}</div>
                            <button class="text-red-400 hover:text-red-300 transition p-1" 
                                    onclick="event.stopPropagation(); tempMail.deleteEmail('${email.id}')" 
                                    data-bs-toggle="tooltip" 
                                    data-bs-placement="top" 
                                    title="Delete email">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="text-gray-300">${this.escapeHtml(email.subject || 'No Subject')}</div>
                </div>
            `;
        }).join('');

        // Reinitialize tooltips for new elements
        this.initializeTooltips();
    }

    updateEmailDisplay() {
        const display = document.getElementById('emailDisplay');
        if (this.currentEmail) {
            display.innerHTML = `<span>${this.currentEmail}</span>`;
        } else {
            display.innerHTML = '<span>No email generated</span>';
        }
    }

    copyEmail() {
        if (this.currentEmail) {
            navigator.clipboard.writeText(this.currentEmail).then(() => {
                const btn = document.querySelector('button[onclick="copyEmail()"]');
                this.showStatus(btn, 'Email copied!', 'success');

                if (typeof trackEmailCopy === 'function') {
                    trackEmailCopy();
                }
            }).catch(err => {
                console.error('Copy failed:', err);
                const btn = document.querySelector('button[onclick="copyEmail()"]');
                this.showStatus(btn, 'Copy failed', 'danger');
            });
        }
   }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            const activeButton = document.activeElement;
            if (activeButton && activeButton.tagName === 'BUTTON') {
                this.showStatus(activeButton, 'Text copied!', 'success');
            }
        }).catch(err => {
            console.error('Copy failed:', err);
            const activeButton = document.activeElement;
            if (activeButton && activeButton.tagName === 'BUTTON') {
                this.showStatus(activeButton, 'Copy failed', 'danger');
            }
        });
    }

    async showEmailDetails(messageId) {
        try {
            const emailData = await this.getEmailContent(messageId);
            if (!emailData) {
                throw new Error('Failed to get email content');
            }

            // Update modal content
            document.getElementById('modalFrom').textContent = emailData.from?.address || 'Unknown Sender';
            document.getElementById('modalSubject').textContent = emailData.subject || 'No Subject';
            document.getElementById('modalDate').textContent = this.formatDate(emailData.createdAt);

            // Handle email content
            let content = emailData.html || emailData.text || 'No content';
            if (emailData.html) {
                // Sanitize HTML content if available
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                content = tempDiv.innerHTML;
            } else {
                // Format plain text with line breaks
                content = this.escapeHtml(content).replace(/\n/g, '<br>');
            }
            document.getElementById('modalContent').innerHTML = content;

            // Show the modal
            const emailModal = new bootstrap.Modal(document.getElementById('emailModal'));
            emailModal.show();

        } catch (error) {
            console.error('Show email details error:', error.message);
            // Show error message to user
            const activeElement = document.activeElement;
            if (activeElement) {
                this.showStatus(activeElement, 'Error loading email', 'danger');
            }
        }
    }

    toggleAutoRefresh() {
        this.autoRefreshEnabled = !this.autoRefreshEnabled;
        const btn = document.getElementById('autoRefreshBtn');
        
        if (this.autoRefreshEnabled) {
            this.startAutoRefresh();
            this.showStatus(btn, 'Auto-refresh enabled', 'success');
            btn.innerHTML = '<i class="fas fa-clock mr-2"></i>Auto-Refresh: ON';
        } else {
            this.stopAutoRefresh();
            this.showStatus(btn, 'Auto-refresh disabled', 'info');
            btn.innerHTML = '<i class="fas fa-clock mr-2"></i>Auto-Refresh: OFF';
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshEnabled && !this.refreshInterval) {
            this.refreshInterval = setInterval(() => this.checkEmails(), this.refreshFrequency);
            // Also update the button state
            const btn = document.getElementById('autoRefreshBtn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-clock mr-2"></i>Auto-Refresh: ON';
            }
        }
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    setRefreshButton(loading) {
        const btn = document.getElementById('refreshBtn');
        btn.disabled = loading;
        btn.innerHTML = loading ? 
            '<div class="loading-spinner mr-2"></div>Refreshing...' : 
            '<i class="fas fa-sync-alt mr-2"></i>Refresh';
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch (e) {
            return dateString || '';
        }
    }

    saveMailbox() {
        if (this.currentEmail && this.currentToken) {
            this.savedMailboxes[this.currentEmail] = {
                token: this.currentToken,
                emails: this.emails,
                lastUsed: new Date().toISOString()
            };
            localStorage.setItem('tempMailboxes', JSON.stringify(this.savedMailboxes));
            localStorage.setItem('lastUsedMailbox', this.currentEmail);
        }
    }

    loadSavedData() {
        try {
            const savedData = localStorage.getItem('tempMailboxes');
            if (savedData) {
                this.savedMailboxes = JSON.parse(savedData);
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
            this.savedMailboxes = {};
        }
    }

    updateMailboxSelector() {
        const selector = document.getElementById('mailboxSelector');
        if (!selector) return;

        const currentOptions = Array.from(selector.options).map(opt => opt.value);
        const savedMailboxes = Object.keys(this.savedMailboxes);

        // Remove options that no longer exist
        currentOptions.forEach(opt => {
            if (opt && !savedMailboxes.includes(opt)) {
                selector.remove(selector.querySelector(`option[value="${opt}"]`).index);
            }
        });

        // Add new options
        savedMailboxes.forEach(email => {
            if (!currentOptions.includes(email)) {
                const option = document.createElement('option');
                option.value = email;
                option.textContent = email;
                selector.appendChild(option);
            }
        });

        // Update selected option
        if (this.currentEmail) {
            selector.value = this.currentEmail;
        }
    }

    switchMailbox() {
        const selector = document.getElementById('mailboxSelector');
        const selectedEmail = selector.value;

        if (selectedEmail && this.savedMailboxes[selectedEmail]) {
            this.loadMailbox(selectedEmail);
        }
    }

    loadMailbox(email) {
        if (!this.savedMailboxes[email]) return;

        const mailbox = this.savedMailboxes[email];
        this.currentEmail = email;
        this.currentToken = mailbox.token;
        this.emails = mailbox.emails || [];

        document.getElementById('currentEmailSection').classList.remove('hidden');
        document.getElementById('emailList').classList.remove('hidden');
        
        this.updateEmailDisplay();
        this.updateEmailList();
        this.updateMailboxSelector();
        
        // Start auto-refresh when loading a mailbox
        this.startAutoRefresh();

        localStorage.setItem('lastUsedMailbox', email);
    }

    getLastUsedMailbox() {
        return localStorage.getItem('lastUsedMailbox');
    }

    deleteMailbox() {
        if (this.currentEmail) {
            delete this.savedMailboxes[this.currentEmail];
            localStorage.setItem('tempMailboxes', JSON.stringify(this.savedMailboxes));

            if (this.currentEmail === localStorage.getItem('lastUsedMailbox')) {
                localStorage.removeItem('lastUsedMailbox');
            }

            this.currentEmail = '';
            this.currentToken = '';
            this.emails = [];

            document.getElementById('currentEmailSection').classList.add('hidden');
            document.getElementById('emailList').classList.add('hidden');
            this.updateMailboxSelector();
        }
    }

    async deleteEmail(messageId) {
        if (!messageId || !this.currentToken) return;

        try {
            const response = await fetch(`${this.apiBase}/messages/${messageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.currentToken}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete message: ${response.status}`);
            }

            // Remove the email from local array
            this.emails = this.emails.filter(email => email.id !== messageId);
            
            // Update UI
            this.updateEmailList();
            
            // Save updated state
            this.saveMailbox();
            
            // Show success message
            const activeButton = document.activeElement;
            if (activeButton) {
                this.showStatus(activeButton, 'Email deleted', 'success');
            }

        } catch (error) {
            console.error('Delete email error:', error.message);
            const activeButton = document.activeElement;
            if (activeButton) {
                this.showStatus(activeButton, 'Error deleting email', 'danger');
            }
        }
    }

    async clearAllEmails() {
        if (!this.currentToken || this.emails.length === 0) return;

        try {
            // Delete all emails one by one
            const deletePromises = this.emails.map(email => 
                fetch(`${this.apiBase}/messages/${email.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${this.currentToken}` }
                })
            );

            await Promise.all(deletePromises);

            // Clear local array
            this.emails = [];
            
            // Update UI
            this.updateEmailList();
            
            // Save updated state
            this.saveMailbox();
            
            // Show success message
            const btn = document.querySelector('button[onclick="clearAllEmails()"]');
            if (btn) {
                this.showStatus(btn, 'All emails cleared', 'success');
            }

        } catch (error) {
            console.error('Clear all emails error:', error.message);
            const btn = document.querySelector('button[onclick="clearAllEmails()"]');
            if (btn) {
                this.showStatus(btn, 'Error clearing emails', 'danger');
            }
        }
    }
}
