// app.js - Main Application Logic & Routing

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Database
        await window.appDB.init();
        console.log("Database initialized successfully.");
        
        // Initialize Modules
        if (window.ProfileManager) await window.ProfileManager.init();
        if (window.InventoryManager) await window.InventoryManager.init();
        if (window.InvoiceManager) await window.InvoiceManager.init();

        // Setup Routing (Navigation)
        setupNavigation();
        
        // Setup Theme Toggling
        setupThemeToggle();
        
        // Setup Sidebar Toggle
        setupSidebarToggle();

    } catch (e) {
        console.error("Initialization failed:", e);
        Utils.showToast("Failed to initialize app database.", "error");
    }
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active to clicked
            link.classList.add('active');

            // Hide all views
            views.forEach(v => {
                v.style.display = 'none';
                v.classList.remove('active');
            });
            
            // Show target view
            const targetId = link.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.style.display = 'block';
                targetView.classList.add('active');
                
                // Trigger refresh if needed
                if (targetId === 'view-inventory' && window.InventoryManager) {
                    window.InventoryManager.loadInventory();
                } else if (targetId === 'view-dashboard' && window.InvoiceManager) {
                    window.InvoiceManager.loadHistory();
                }
            }
            
            // Update URL hash without jumping
            history.pushState(null, null, link.getAttribute('href'));
        });
    });

    // Handle initial route based on hash
    const hash = window.location.hash;
    if (hash) {
        const link = document.querySelector(`.nav-link[href="${hash}"]`);
        if (link) link.click();
    }
}

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const lightIcon = btn.querySelector('.light-icon');
    const darkIcon = btn.querySelector('.dark-icon');
    
    // Check saved theme in DB or localStorage
    // For simplicity of immediate rendering, we use localStorage for theme
    const savedTheme = localStorage.getItem('theme') || 'theme-dark';
    document.body.className = savedTheme;
    updateThemeIcons(savedTheme);

    btn.addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
        const newTheme = currentTheme === 'theme-dark' ? 'theme-light' : 'theme-dark';
        
        document.body.className = newTheme;
        localStorage.setItem('theme', newTheme);
        updateThemeIcons(newTheme);
    });

    function updateThemeIcons(theme) {
        if (theme === 'theme-dark') {
            lightIcon.style.display = 'none';
            darkIcon.style.display = 'inline';
        } else {
            lightIcon.style.display = 'inline';
            darkIcon.style.display = 'none';
        }
    }
}

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const appContainer = document.getElementById('app-container');
    const overlay = document.getElementById('sidebar-overlay');
    const navLinks = document.querySelectorAll('.nav-link');

    if (!toggleBtn || !appContainer) return;

    // Set initial sidebar state based on viewport width
    if (window.innerWidth <= 768) {
        appContainer.classList.remove('sidebar-visible');
    } else {
        appContainer.classList.add('sidebar-visible');
    }

    const toggleSidebar = () => {
        appContainer.classList.toggle('sidebar-visible');
    };

    const closeSidebar = () => {
        appContainer.classList.remove('sidebar-visible');
    };

    toggleBtn.addEventListener('click', toggleSidebar);
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Auto-dismiss sidebar on navigation click on mobile/tablets
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}

