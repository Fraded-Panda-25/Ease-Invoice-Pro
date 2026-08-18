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
        if (window.CustomersManager) await window.CustomersManager.init();

        // Setup Routing (Navigation)
        setupNavigation();
        
        // Setup Theme Toggling
        setupThemeToggle();
        
        // Setup Sidebar Toggle
        setupSidebarToggle();

        // Setup Sidebar Resizer
        setupSidebarResizer();

        // Setup Tooltips (inventory + invoice history + sidebar buttons)
        setupTooltips();

        // Setup Glow Intensity & Pulsing Border Settings
        setupPulsingBorderToggle();
        setupPulsingBorderSpeed();
        setupGlowSettings();
        setupResetSettings();

        // Setup Dock Effect (3D magnification)
        setupDockEffect();

        // Setup Dashboard Stat Card click handlers
        setupDashboardStatCards();

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
            navLinks.forEach(l => l.classList.remove('active'))
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
                } else if (targetId === 'view-customers' && window.CustomersManager) {
                    window.CustomersManager.loadCustomers();
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

function setupTooltips() {
    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'inventory-tooltip';
    document.body.appendChild(tooltip);

    let currentTooltipElement = null;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let isTooltipActive = false;

    // Track mouse position globally
    document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        if (isTooltipActive) {
            updateTooltipPosition();
        }
    });

    // Show tooltip on inventory row hover
    document.addEventListener('mouseover', (e) => {
        const row = e.target.closest('.inventory-row');
        if (row) {
            showInventoryTooltip(row);
            return;
        }

        const invoiceRow = e.target.closest('.invoice-history-row');
        if (invoiceRow) {
            showInvoiceTooltip(invoiceRow);
            return;
        }

        const themeToggle = e.target.closest('#theme-toggle');
        if (themeToggle) {
            const isDark = document.body.classList.contains('theme-dark');
            showSimpleTooltip(themeToggle, isDark ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙');
            return;
        }

        const sidebarToggle = e.target.closest('#sidebar-toggle');
        if (sidebarToggle) {
            const isVisible = document.getElementById('app-container').classList.contains('sidebar-visible');
            showSimpleTooltip(sidebarToggle, isVisible ? 'Close Sidebar ✕' : 'Open Sidebar ☰');
            return;
        }

        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            const text = navLink.textContent.trim();
            showSimpleTooltip(navLink, `Navigate to ${text}`);
            return;
        }

        const statCard = e.target.closest('.stat-card');
        if (statCard) {
            showStatTooltip(statCard);
            return;
        }

        // Invoice action buttons
        const viewBtn = e.target.closest('.view-invoice-btn');
        if (viewBtn) {
            showSimpleTooltip(viewBtn, '👁️ View invoice details');
            return;
        }

        const deleteBtn = e.target.closest('.delete-invoice-btn');
        if (deleteBtn) {
            showSimpleTooltip(deleteBtn, '⚠️ Delete invoice (cannot be undone)');
            return;
        }
    });

    document.addEventListener('mouseout', (e) => {
        const row = e.target.closest('.inventory-row');
        const invoiceRow = e.target.closest('.invoice-history-row');
        const themeToggle = e.target.closest('#theme-toggle');
        const sidebarToggle = e.target.closest('#sidebar-toggle');
        const navLink = e.target.closest('.nav-link');
        const statCard = e.target.closest('.stat-card');
        const viewBtn = e.target.closest('.view-invoice-btn');
        const deleteBtn = e.target.closest('.delete-invoice-btn');
        
        if (row || invoiceRow || themeToggle || sidebarToggle || navLink || statCard || viewBtn || deleteBtn) {
            hideTooltip();
        }
    });

    // Keyboard shortcut: Press Escape to dismiss tooltip
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isTooltipActive) {
            hideTooltip();
        }
    });

    function showInventoryTooltip(row) {
        const name = row.dataset.productName;
        const company = row.dataset.productCompany;
        const variant = row.dataset.productVariant;
        const price = row.dataset.productPrice;
        const stock = parseInt(row.dataset.productStock, 10);
        const gst = row.dataset.productGst;
        const discount = row.dataset.productDiscount;
        const threshold = parseInt(row.dataset.productThreshold, 10);

        const stockStatus = stock <= 0 ? 'Out of Stock' : stock <= threshold ? 'Low Stock' : 'In Stock';
        const stockClass = stock <= 0 ? 'danger' : stock <= threshold ? 'danger' : 'success';

        tooltip.innerHTML = `
            <div class="tooltip-title">${name}</div>
            <div class="tooltip-row">
                <span class="tooltip-label">Company</span>
                <span class="tooltip-value">${company}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Variant</span>
                <span class="tooltip-value">${variant}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Price</span>
                <span class="tooltip-value highlight">${price}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">GST</span>
                <span class="tooltip-value">${gst}%</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Discount</span>
                <span class="tooltip-value">${discount}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Stock</span>
                <span class="tooltip-value ${stockClass}">${stock} (${stockStatus})</span>
            </div>
        `;

        showTooltip(row);
    }

    function showInvoiceTooltip(row) {
        const date = row.dataset.invoiceDate;
        const number = row.dataset.invoiceNumber;
        const customer = row.dataset.invoiceCustomer;
        const total = row.dataset.invoiceTotal;
        const items = row.dataset.invoiceItems;

        tooltip.innerHTML = `
            <div class="tooltip-title">Invoice #${number}</div>
            <div class="tooltip-row">
                <span class="tooltip-label">Date</span>
                <span class="tooltip-value">${date}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Customer</span>
                <span class="tooltip-value">${customer}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Total</span>
                <span class="tooltip-value highlight">${total}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Items</span>
                <span class="tooltip-value">${items}</span>
            </div>
        `;

        showTooltip(row);
    }

    function showSimpleTooltip(element, text) {
        tooltip.innerHTML = `<div class="tooltip-title" style="border:none; margin:0; padding:0;">${text}</div>`;
        showTooltip(element);
    }

    function showStatTooltip(card) {
        const label = card.querySelector('.stat-label').textContent.trim();
        const value = card.querySelector('.stat-value').textContent.trim();
        let content = '';

        if (label === 'Products') {
            content = `
                <div class="tooltip-title">📦 Products Overview</div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Total Products</span>
                    <span class="tooltip-value highlight">${value}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Tip</span>
                    <span class="tooltip-value">Click Inventory to manage</span>
                </div>
            `;
        } else if (label === 'Sold This Month') {
            content = `
                <div class="tooltip-title">🛒 Sales This Month</div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Units Sold</span>
                    <span class="tooltip-value highlight">${value}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Period</span>
                    <span class="tooltip-value">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Tip</span>
                    <span class="tooltip-value">Based on invoice history</span>
                </div>
            `;
        } else if (label === 'Restocked This Month') {
            content = `
                <div class="tooltip-title">📥 Restocked This Month</div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Units Restocked</span>
                    <span class="tooltip-value highlight">${value}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Period</span>
                    <span class="tooltip-value">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Tip</span>
                    <span class="tooltip-value">From restock actions</span>
                </div>
            `;
        } else if (label === 'Low Stock Items') {
            const isWarning = parseInt(value, 10) > 0;
            content = `
                <div class="tooltip-title">⚠️ Low Stock Alert</div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Items Below Threshold</span>
                    <span class="tooltip-value ${isWarning ? 'danger' : 'success'}">${value}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Status</span>
                    <span class="tooltip-value ${isWarning ? 'danger' : 'success'}">${isWarning ? 'Needs Attention' : 'All Good!'}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Tip</span>
                    <span class="tooltip-value">Click Inventory to restock</span>
                </div>
            `;
        } else if (label.includes('⚠ Approaching Low Stock')) {
            const count = parseInt(value, 10);
            content = `
                <div class="tooltip-title">🟡 Approaching Low Stock</div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Items Near Threshold</span>
                    <span class="tooltip-value ${count > 0 ? 'warning' : 'success'}">${value}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Range</span>
                    <span class="tooltip-value">Within 5 units of threshold</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Tip</span>
                    <span class="tooltip-value">Restock before they run low</span>
                </div>
            `;
        } else {
            content = `<div class="tooltip-title" style="border:none; margin:0; padding:0;">${label}: ${value}</div>`;
        }

        tooltip.innerHTML = content;
        showTooltip(card);
    }

    function showTooltip(element) {
        // Store reference to the element for glow effect
        currentTooltipElement = element;
        isTooltipActive = true;

        // Add glow effect to the element
        element.classList.add('tooltip-glow');

        // Position tooltip near cursor
        updateTooltipPosition();

        tooltip.classList.add('visible');
    }

    function updateTooltipPosition() {
        if (!isTooltipActive) return;

        const offset = 16; // Gap between cursor and tooltip
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = lastMouseX + offset;
        let top = lastMouseY + offset;

        // Ensure tooltip stays within viewport
        if (left + tooltipRect.width > window.innerWidth) {
            left = lastMouseX - tooltipRect.width - offset;
        }
        if (top + tooltipRect.height > window.innerHeight) {
            top = lastMouseY - tooltipRect.height - offset;
        }
        if (left < 0) left = offset;
        if (top < 0) top = offset;

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
        isTooltipActive = false;
        // Remove glow effect from the element
        if (currentTooltipElement) {
            currentTooltipElement.classList.remove('tooltip-glow');
            currentTooltipElement = null;
        }
        tooltip.classList.remove('visible');
    }
}

function setupDashboardStatCards() {
    const statCards = document.querySelectorAll('#dashboard-stats .stat-card[data-action]');
    
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const action = card.getAttribute('data-action');
            
            if (action === 'inventory') {
                // Navigate to Inventory page
                const inventoryLink = document.querySelector('.nav-link[data-target="view-inventory"]');
                if (inventoryLink) inventoryLink.click();
            } else if (action === 'sales-history') {
                // Open Stock History modal filtered to Sales only
                if (window.InventoryManager) {
                    window.InventoryManager.showAllHistory();
                    // Pre-select 'sale' type after modal renders
                    requestAnimationFrame(() => {
                        const typeFilter = document.getElementById('filter-history-type');
                        if (typeFilter) {
                            typeFilter.value = 'sale';
                            typeFilter.dispatchEvent(new Event('change'));
                        }
                    });
                }
            } else if (action === 'restock-history') {
                // Open Stock History modal - All Products
                if (window.InventoryManager) {
                    window.InventoryManager.showAllHistory();
                }
            } else if (action === 'low-stock') {
                // Open Low Stock Items modal
                if (window.InventoryManager) {
                    window.InventoryManager.showLowStockItems();
                }
            } else if (action === 'approaching-low-stock') {
                // Open Approaching Low Stock items modal
                if (window.InventoryManager) {
                    window.InventoryManager.showApproachingLowItems();
                }
            }
        });
    });
}

/**
 * Convert a CSS color string to rgba() with the given alpha.
 * Handles hex (#fff, #ffffff) and functional (rgb(), hsl()) formats.
 */
function colorWithAlpha(color, alpha) {
    const trimmed = color.trim();
    if (trimmed.startsWith('#')) {
        let hex = trimmed.slice(1);
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return trimmed;
    }
    // For rgb(), hsl(), etc. — insert alpha before the closing paren
    return trimmed.replace(')', `, ${alpha})`);
}

function setupDockEffect() {
    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // macOS Dock-like magnification effect for sidebar, stat cards, and table rows
    const setupMagnification = (containerSelector, itemSelector, maxScale = 1.15, range = 150) => {
        const containers = document.querySelectorAll(containerSelector);
        
        containers.forEach(container => {
            const items = container.querySelectorAll(itemSelector);
            if (items.length === 0) return;

            container.addEventListener('mousemove', (e) => {
                const containerRect = container.getBoundingClientRect();
                const mouseX = e.clientX - containerRect.left;
                
                // Read theme colors fresh on every frame — handles theme toggles
                const rootStyle = getComputedStyle(document.documentElement);
                const dangerColor = rootStyle.getPropertyValue('--danger').trim() || '#f87171';
                const primaryColor = rootStyle.getPropertyValue('--primary').trim() || '#38bdf8';

                items.forEach(item => {
                    const itemRect = item.getBoundingClientRect();
                    const itemCenter = itemRect.left - containerRect.left + itemRect.width / 2;
                    const distance = Math.abs(mouseX - itemCenter);
                    
                    if (distance < range) {
                        const scale = 1 + (maxScale - 1) * (1 - distance / range);
                        const translateY = -((maxScale - 1) * 20) * (1 - distance / range);
                        const rotateX = 8 * (1 - distance / range);
                        item.style.transform = `translateY(${translateY}px) scale(${scale}) rotateX(${rotateX}deg)`;
                        
                        // Determine glow color and opacity based on stock status
                        const isLowStock = item.classList.contains('inventory-row--low-stock') || item.classList.contains('stat-low-stock') || item.classList.contains('invoice-row--low-stock');
                        const isApproachingLow = item.classList.contains('inventory-row--approaching-low-stock') || item.classList.contains('stat-approaching-low-stock');
                        const warningColor = rootStyle.getPropertyValue('--warning').trim() || '#f59e0b';
                        let glowColor, opacity;
                        if (isLowStock) {
                            glowColor = dangerColor;
                            opacity = _glowLowStockOpacity;
                        } else if (isApproachingLow) {
                            glowColor = warningColor;
                            opacity = _glowApproachingOpacity;
                        } else {
                            glowColor = primaryColor;
                            opacity = _glowNormalOpacity;
                        }
                        // Skip glow if opacity is 0
                        if (opacity <= 0) {
                            item.style.boxShadow = '';
                        } else {
                            const shadowIntensity = 1 - distance / range;
                            item.style.boxShadow = `0 ${12 * shadowIntensity}px ${24 * shadowIntensity}px -4px ${colorWithAlpha(glowColor, opacity * shadowIntensity)}`;
                        }
                    } else {
                        item.style.transform = '';
                        item.style.boxShadow = '';
                    }
                });
            });

            container.addEventListener('mouseleave', () => {
                items.forEach(item => {
                    item.style.transform = '';
                    item.style.boxShadow = '';
                });
            });
        });
    };

    // Sidebar navigation buttons
    setupMagnification('.main-nav', '.nav-link', 1.12, 120);
    
    // Sidebar footer buttons (theme toggle)
    setupMagnification('.sidebar-footer', '.btn', 1.1, 100);
    
    // Dashboard stat cards
    setupMagnification('.stats-grid', '.stat-card', 1.08, 180);
    
    // Invoice builder line items table rows
    setupMagnification('#invoice-items-table', 'tbody tr', 1.03, 100);
    
    // Invoice history table rows
    setupMagnification('#history-table', 'tbody tr', 1.03, 100);
    
    // Inventory table rows
    setupMagnification('#inventory-table', 'tbody tr', 1.03, 100);

    // Sidebar toggle button - 3D zoom effect
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('mouseenter', () => {
            sidebarToggle.style.transform = 'scale(1.15) rotateX(8deg)';
            sidebarToggle.style.boxShadow = '0 12px 24px -4px rgba(56, 189, 248, 0.25)';
        });
        sidebarToggle.addEventListener('mouseleave', () => {
            sidebarToggle.style.transform = '';
            sidebarToggle.style.boxShadow = '';
        });
    }
}

// Cached glow intensities (avoids localStorage reads on every mousemove)
let _glowNormalOpacity = 0.25;
let _glowLowStockOpacity = 0.35;
let _glowApproachingOpacity = 0.30;

function setupPulsingBorderToggle() {
    const toggle = document.getElementById('toggle-pulsing-border');
    if (!toggle) return;

    // Restore saved state
    const saved = localStorage.getItem('pulsingBorderEnabled');
    const enabled = saved !== null ? saved === 'true' : true;
    toggle.checked = enabled;
    document.body.classList.toggle('pulsing-border-off', !enabled);

    // Save on change
    toggle.addEventListener('change', () => {
        localStorage.setItem('pulsingBorderEnabled', toggle.checked);
        document.body.classList.toggle('pulsing-border-off', !toggle.checked);
    });
}

function setupPulsingBorderSpeed() {
    const radios = document.querySelectorAll('input[name="pulsing-speed"]');
    if (!radios.length) return;

    // Speed values map
    const speedMap = { slow: '4s', normal: '2.5s', fast: '1.2s' };

    // Restore saved speed
    const saved = localStorage.getItem('pulsingBorderSpeed') || 'normal';
    const radioToCheck = document.getElementById('speed-' + saved);
    if (radioToCheck) {
        radioToCheck.checked = true;
        document.documentElement.style.setProperty('--pulsing-border-speed', speedMap[saved] || '2.5s');
    }

    // Save on change
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            const val = radio.value;
            localStorage.setItem('pulsingBorderSpeed', val);
            document.documentElement.style.setProperty('--pulsing-border-speed', speedMap[val] || '2.5s');
        });
    });
}

function setupGlowSettings() {
    const normalSlider = document.getElementById('glow-normal-intensity');
    const lowStockSlider = document.getElementById('glow-lowstock-intensity');
    const normalValue = document.getElementById('glow-normal-value');
    const lowStockValue = document.getElementById('glow-lowstock-value');

    // Restore saved values from localStorage
    const savedNormal = localStorage.getItem('glowNormalIntensity');
    const savedLowStock = localStorage.getItem('glowLowStockIntensity');
    if (savedNormal !== null && normalSlider) {
        normalSlider.value = savedNormal;
        _glowNormalOpacity = parseInt(savedNormal, 10) / 100;
    }
    if (savedLowStock !== null && lowStockSlider) {
        lowStockSlider.value = savedLowStock;
        _glowLowStockOpacity = parseInt(savedLowStock, 10) / 100;
    }
    if (normalValue) normalValue.textContent = (normalSlider ? normalSlider.value : 25) + '%';
    if (lowStockValue) lowStockValue.textContent = (lowStockSlider ? lowStockSlider.value : 35) + '%';

    // Save on change and update cache
    if (normalSlider) {
        normalSlider.addEventListener('input', () => {
            const val = normalSlider.value;
            localStorage.setItem('glowNormalIntensity', val);
            _glowNormalOpacity = parseInt(val, 10) / 100;
            if (normalValue) normalValue.textContent = val + '%';
        });
    }
    if (lowStockSlider) {
        lowStockSlider.addEventListener('input', () => {
            const val = lowStockSlider.value;
            localStorage.setItem('glowLowStockIntensity', val);
            _glowLowStockOpacity = parseInt(val, 10) / 100;
            if (lowStockValue) lowStockValue.textContent = val + '%';
        });
    }
}

function setupResetSettings() {
    const btn = document.getElementById('btn-reset-visual-settings');
    if (!btn) return;

    btn.addEventListener('click', () => {
        // Remove all visual-preference localStorage keys
        localStorage.removeItem('glowNormalIntensity');
        localStorage.removeItem('glowLowStockIntensity');
        localStorage.removeItem('pulsingBorderEnabled');
        localStorage.removeItem('pulsingBorderSpeed');
        localStorage.removeItem('theme');

        // Reset cached glow opacities
        _glowNormalOpacity = 0.25;
        _glowLowStockOpacity = 0.35;
        _glowApproachingOpacity = 0.30;

        // Reset glow sliders and value labels
        const normalSlider = document.getElementById('glow-normal-intensity');
        const lowStockSlider = document.getElementById('glow-lowstock-intensity');
        const normalValue = document.getElementById('glow-normal-value');
        const lowStockValue = document.getElementById('glow-lowstock-value');
        if (normalSlider) { normalSlider.value = '25'; }
        if (lowStockSlider) { lowStockSlider.value = '35'; }
        if (normalValue) { normalValue.textContent = '25%'; }
        if (lowStockValue) { lowStockValue.textContent = '35%'; }

        // Reset pulsing border toggle to ON
        const toggle = document.getElementById('toggle-pulsing-border');
        if (toggle) {
            toggle.checked = true;
            document.body.classList.remove('pulsing-border-off');
        }

        // Reset pulsing border speed to Normal
        const normalRadio = document.getElementById('speed-normal');
        if (normalRadio) {
            normalRadio.checked = true;
            document.documentElement.style.setProperty('--pulsing-border-speed', '2.5s');
        }

        // Reset theme to dark
        document.body.className = 'theme-dark';
        const lightIcon = document.querySelector('#theme-toggle .light-icon');
        const darkIcon = document.querySelector('#theme-toggle .dark-icon');
        if (lightIcon) lightIcon.style.display = 'none';
        if (darkIcon) darkIcon.style.display = 'inline';

        Utils.showToast('✅ All visual settings reset to defaults', 'success');
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
