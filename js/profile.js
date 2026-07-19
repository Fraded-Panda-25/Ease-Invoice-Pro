// profile.js - Business Profile & Settings

const ProfileManager = {
    profileData: {
        id: 'main', // Single record
        name: '',
        address: '',
        gstin: '',
        phone: '',
        prefix: 'INV-',
        logo: '',
        logoShape: 'banner'
    },

    async init() {
        await this.loadProfile();
        this.bindEvents();
    },

    async loadProfile() {
        try {
            const data = await window.appDB.get('profile', 'main');
            if (data) {
                this.profileData = data;
                this.populateForm();
                this.updateNavLogo();
            }
        } catch (e) {
            console.error("Failed to load profile", e);
        }
    },

    populateForm() {
        document.getElementById('biz-name').value = this.profileData.name || '';
        document.getElementById('biz-address').value = this.profileData.address || '';
        document.getElementById('biz-gstin').value = this.profileData.gstin || '';
        document.getElementById('biz-phone').value = this.profileData.phone || '';
        document.getElementById('biz-prefix').value = this.profileData.prefix || 'INV-';
        
        document.getElementById('biz-logo-shape').value = this.profileData.logoShape || 'banner';
        
        if (this.profileData.logo) {
            const preview = document.getElementById('logo-preview');
            preview.src = this.profileData.logo;
            preview.className = 'logo-shape-' + (this.profileData.logoShape || 'banner');
            preview.style.display = 'block';
        }
    },

    updateNavLogo() {
        const navName = document.getElementById('nav-biz-name');
        const navLogo = document.getElementById('nav-logo');
        
        if (this.profileData.name) {
            navName.textContent = this.profileData.name;
        }
        if (this.profileData.logo) {
            navLogo.src = this.profileData.logo;
            navLogo.className = 'nav-logo-img logo-shape-' + (this.profileData.logoShape || 'banner');
            navLogo.style.display = 'block';
        }
    },

    bindEvents() {
        const form = document.getElementById('form-profile');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProfile();
        });

        const logoInput = document.getElementById('biz-logo');
        logoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const base64 = await Utils.fileToBase64(file);
                    this.profileData.logo = base64;
                    const preview = document.getElementById('logo-preview');
                    preview.src = base64;
                    preview.className = 'logo-shape-' + (this.profileData.logoShape || 'banner');
                    preview.style.display = 'block';
                } catch (err) {
                    Utils.showToast("Failed to process image", "error");
                }
            }
        });

        const shapeInput = document.getElementById('biz-logo-shape');
        shapeInput.addEventListener('change', (e) => {
            this.profileData.logoShape = e.target.value;
            const preview = document.getElementById('logo-preview');
            if (preview && preview.style.display !== 'none') {
                preview.className = 'logo-shape-' + e.target.value;
            }
        });

        // Data Management Events
        document.getElementById('btn-export-data').addEventListener('click', async () => {
            try {
                const dataStr = await window.appDB.exportData();
                const blob = new Blob([dataStr], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `EaseInvoice_Backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                Utils.showToast("Data exported successfully!");
            } catch (e) {
                Utils.showToast("Export failed", "error");
            }
        });

        document.getElementById('btn-import-data').addEventListener('click', async () => {
            const fileInput = document.getElementById('import-file');
            if (!fileInput.files.length) {
                Utils.showToast("Please select a file first", "warning");
                return;
            }
            
            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    await window.appDB.importData(e.target.result);
                    Utils.showToast("Data imported successfully! Reloading...");
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    Utils.showToast("Invalid backup file", "error");
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('btn-clear-data').addEventListener('click', async () => {
            if (confirm("Are you SURE you want to delete all data? This cannot be undone!")) {
                if (confirm("Please confirm again. All products and invoices will be lost.")) {
                    try {
                        await window.appDB.clear('profile');
                        await window.appDB.clear('products');
                        await window.appDB.clear('invoices');
                        await window.appDB.clear('stockHistory');
                        Utils.showToast("All data cleared. Reloading...");
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (e) {
                        Utils.showToast("Failed to clear data", "error");
                    }
                }
            }
        });

        document.getElementById('btn-clear-stock-history').addEventListener('click', async () => {
            if (confirm("Delete all stock history entries? This cannot be undone.")) {
                try {
                    await window.appDB.clear('stockHistory');
                    Utils.showToast("Stock history cleared.", "success");
                } catch (e) {
                    Utils.showToast("Failed to clear stock history", "error");
                }
            }
        });
    },

    async saveProfile() {
        this.profileData.name = document.getElementById('biz-name').value;
        this.profileData.address = document.getElementById('biz-address').value;
        this.profileData.gstin = document.getElementById('biz-gstin').value;
        this.profileData.phone = document.getElementById('biz-phone').value;
        this.profileData.prefix = document.getElementById('biz-prefix').value;
        this.profileData.logoShape = document.getElementById('biz-logo-shape').value;
        // Logo is handled via change event

        try {
            await window.appDB.put('profile', this.profileData);
            this.updateNavLogo();
            Utils.showToast("Profile saved successfully!");
        } catch (e) {
            console.error(e);
            Utils.showToast("Failed to save profile", "error");
        }
    }
};

window.ProfileManager = ProfileManager;
