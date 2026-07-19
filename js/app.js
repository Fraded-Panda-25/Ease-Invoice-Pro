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

        // Setup Sidebar Resizer
        setupSidebarResizer();

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
                    window.InvoiceManager.renderDashboardStats();
                }
            }
            
            // Update URL hash without jumping
            history.pushState(null, null, link.getAttribute('href'));
        });
    });

    // Handle hash-based navigation (browser back/forward, or URL changes)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (hash) {
            const link = document.querySelector(`.nav-link[href="${hash}"]`);
            if (link) link.click();
        }
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

function setupSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.querySelector('.sidebar');
    if (!resizer || !sidebar) return;

    const MIN_WIDTH = 180;
    const MAX_WIDTH = 420;
    const STORAGE_KEY = 'sidebarWidth';

    // Restore saved width on load
    const savedWidth = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (savedWidth && savedWidth >= MIN_WIDTH && savedWidth <= MAX_WIDTH) {
        document.documentElement.style.setProperty('--sidebar-width', savedWidth + 'px');
    }

    let startX = 0;
    let startWidth = 0;
    let isDragging = false;

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const delta = e.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        resizer.classList.remove('is-resizing');
        document.body.classList.remove('sidebar-resizing');

        // Save the current width to localStorage
        const currentWidth = sidebar.getBoundingClientRect().width;
        if (currentWidth >= MIN_WIDTH && currentWidth <= MAX_WIDTH) {
            localStorage.setItem(STORAGE_KEY, Math.round(currentWidth));
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', (e) => {
        // Only allow resize on desktop (not on mobile overlay)
        if (window.innerWidth <= 768) return;

        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startWidth = sidebar.getBoundingClientRect().width;

        resizer.classList.add('is-resizing');
        document.body.classList.add('sidebar-resizing');

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}
