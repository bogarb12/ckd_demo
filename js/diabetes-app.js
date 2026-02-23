/**
 * Diabetes Tracking App - Main Controller
 * Handles API communication, localStorage fallback, navigation, and app initialization.
 */

// ============================================================================
// LocalDB - localStorage Fallback
// ============================================================================

const LocalDB = {
    STORAGE_KEY: 'diabetes_patients',

    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('LocalDB.getAll error:', e);
            return [];
        }
    },

    get(id) {
        const patients = this.getAll();
        return patients.find(p => p.id === id || p.hn === id) || null;
    },

    save(data) {
        try {
            const patients = this.getAll();
            const existingIndex = patients.findIndex(
                p => (data.id && p.id === data.id) || (data.hn && p.hn === data.hn)
            );

            if (existingIndex >= 0) {
                // Merge all sections into the existing patient object
                patients[existingIndex] = {
                    ...patients[existingIndex],
                    ...data,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // New patient entry
                data.id = data.id || 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                data.createdAt = new Date().toISOString();
                data.updatedAt = new Date().toISOString();
                patients.push(data);
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
            return data;
        } catch (e) {
            console.error('LocalDB.save error:', e);
            throw e;
        }
    },

    delete(id) {
        try {
            let patients = this.getAll();
            patients = patients.filter(p => p.id !== id && p.hn !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
            return true;
        } catch (e) {
            console.error('LocalDB.delete error:', e);
            return false;
        }
    },

    saveQuestionnaire(id, data) {
        try {
            const patients = this.getAll();
            const index = patients.findIndex(p => p.id === id || p.hn === id);

            if (index >= 0) {
                patients[index].questionnaire = {
                    ...patients[index].questionnaire,
                    ...data
                };
                patients[index].updatedAt = new Date().toISOString();
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
                return patients[index];
            } else {
                // Create a new entry with the questionnaire data attached
                const newPatient = {
                    id: id || 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    questionnaire: data,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                patients.push(newPatient);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
                return newPatient;
            }
        } catch (e) {
            console.error('LocalDB.saveQuestionnaire error:', e);
            throw e;
        }
    },

    exportCSV() {
        const patients = this.getAll();
        if (patients.length === 0) {
            return null;
        }

        // Collect all unique keys across every patient (flattened with dot notation)
        const allKeys = new Set();
        patients.forEach(function (patient) {
            _flattenKeys(patient, '', allKeys);
        });

        const sortedKeys = Array.from(allKeys).sort();

        // BOM for Thai Excel support
        const BOM = '\uFEFF';

        // Build CSV header row
        const headerRow = sortedKeys.map(function (key) {
            return '"' + key.replace(/"/g, '""') + '"';
        }).join(',');

        // Build data rows
        const dataRows = patients.map(function (patient) {
            const flat = {};
            _flattenObject(patient, '', flat);
            return sortedKeys.map(function (key) {
                const val = flat[key] !== undefined ? String(flat[key]) : '';
                return '"' + val.replace(/"/g, '""') + '"';
            }).join(',');
        });

        return BOM + headerRow + '\n' + dataRows.join('\n');
    }
};

/**
 * Helper: recursively collect flattened keys from a nested object.
 */
function _flattenKeys(obj, prefix, keysSet) {
    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const fullKey = prefix ? prefix + '.' + key : key;
        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
            _flattenKeys(val, fullKey, keysSet);
        } else {
            keysSet.add(fullKey);
        }
    }
}

/**
 * Helper: recursively flatten an object into dot-notation key-value pairs.
 */
function _flattenObject(obj, prefix, result) {
    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const fullKey = prefix ? prefix + '.' + key : key;
        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
            _flattenObject(val, fullKey, result);
        } else if (Array.isArray(val)) {
            result[fullKey] = val.join('; ');
        } else {
            result[fullKey] = val;
        }
    }
}

// ============================================================================
// API Client
// ============================================================================

const API = {
    // Auto-detect base path from page URL
    // e.g. /diabetes/diabetes.html → baseUrl = '/diabetes'
    // e.g. /diabetes.html → baseUrl = ''
    baseUrl: (function() {
        var path = window.location.pathname;
        var lastSlash = path.lastIndexOf('/');
        return lastSlash > 0 ? path.substring(0, lastSlash) : '';
    })(),
    dbConnected: false,

    async checkStatus() {
        try {
            const response = await fetch(this.baseUrl + '/api/status');
            if (!response.ok) throw new Error('Status check failed');
            const result = await response.json();
            this.dbConnected = !!(result && result.dbConnected);
            return result;
        } catch (e) {
            console.warn('API.checkStatus: Server not available, using localStorage fallback.', e.message);
            this.dbConnected = false;
            return { dbConnected: false };
        }
    },

    async getPatients() {
        if (!this.dbConnected) {
            return LocalDB.getAll();
        }
        try {
            const response = await fetch(this.baseUrl + '/api/patients');
            if (!response.ok) throw new Error('Failed to fetch patients');
            return await response.json();
        } catch (e) {
            console.error('API.getPatients error, falling back to localStorage:', e.message);
            showToast('Cannot reach server. Using local data.', 'error');
            return LocalDB.getAll();
        }
    },

    async getPatient(id) {
        if (!this.dbConnected) {
            return LocalDB.get(id);
        }
        try {
            const response = await fetch(this.baseUrl + '/api/patients/' + encodeURIComponent(id));
            if (!response.ok) throw new Error('Failed to fetch patient');
            return await response.json();
        } catch (e) {
            console.error('API.getPatient error, falling back to localStorage:', e.message);
            showToast('Cannot reach server. Using local data.', 'error');
            return LocalDB.get(id);
        }
    },

    async savePatient(data) {
        if (!this.dbConnected) {
            const saved = LocalDB.save(data);
            showToast('Saved locally (offline mode).', 'info');
            return saved;
        }
        try {
            const response = await fetch(this.baseUrl + '/api/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save patient');
            const result = await response.json();
            showToast('Saved successfully.', 'success');
            return result;
        } catch (e) {
            console.error('API.savePatient error, falling back to localStorage:', e.message);
            showToast('Server error. Saved locally instead.', 'error');
            return LocalDB.save(data);
        }
    },

    async saveQuestionnaire(id, data) {
        if (!this.dbConnected) {
            const saved = LocalDB.saveQuestionnaire(id, data);
            showToast('Questionnaire saved locally (offline mode).', 'info');
            return saved;
        }
        try {
            const response = await fetch(this.baseUrl + '/api/questionnaire/' + encodeURIComponent(id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save questionnaire');
            const result = await response.json();
            showToast('Questionnaire saved successfully.', 'success');
            return result;
        } catch (e) {
            console.error('API.saveQuestionnaire error, falling back to localStorage:', e.message);
            showToast('Server error. Questionnaire saved locally.', 'error');
            return LocalDB.saveQuestionnaire(id, data);
        }
    },

    async getDashboardSummary() {
        if (!this.dbConnected) {
            return _buildLocalDashboardSummary();
        }
        try {
            const response = await fetch(this.baseUrl + '/api/dashboard/summary');
            if (!response.ok) throw new Error('Failed to fetch dashboard summary');
            return await response.json();
        } catch (e) {
            console.error('API.getDashboardSummary error, falling back to localStorage:', e.message);
            showToast('Cannot reach server. Showing local data.', 'error');
            return _buildLocalDashboardSummary();
        }
    },

    async exportCSV() {
        if (!this.dbConnected) {
            return _downloadLocalCSV();
        }
        try {
            const response = await fetch(this.baseUrl + '/api/export/csv');
            if (!response.ok) throw new Error('Failed to export CSV');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'diabetes_patients_export.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('CSV exported successfully.', 'success');
        } catch (e) {
            console.error('API.exportCSV error, falling back to localStorage:', e.message);
            showToast('Server error. Exporting from local data.', 'error');
            return _downloadLocalCSV();
        }
    }
};

/**
 * Build a dashboard summary object from localStorage data.
 */
function _buildLocalDashboardSummary() {
    const patients = LocalDB.getAll();
    const total = patients.length;
    const experimental = patients.filter(function (p) {
        return p.group === 'experimental' || p.group === 'exp';
    }).length;
    const control = patients.filter(function (p) {
        return p.group === 'control' || p.group === 'ctrl';
    }).length;

    return {
        total: total,
        experimental: experimental,
        control: control,
        source: 'localStorage'
    };
}

/**
 * Trigger a file download of CSV generated from localStorage data.
 */
function _downloadLocalCSV() {
    const csvContent = LocalDB.exportCSV();
    if (!csvContent) {
        showToast('No data to export.', 'info');
        return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diabetes_patients_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported from local data.', 'success');
}

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message, type) {
    type = type || 'info';

    var colorMap = {
        success: '#28a745',
        error: '#dc3545',
        info: '#007bff'
    };

    var bgColor = colorMap[type] || colorMap.info;

    var toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.textContent = message;
    toast.style.cssText = [
        'position: fixed',
        'bottom: 80px',
        'left: 50%',
        'transform: translateX(-50%)',
        'background-color: ' + bgColor,
        'color: #fff',
        'padding: 12px 24px',
        'border-radius: 8px',
        'font-size: 14px',
        'z-index: 10000',
        'box-shadow: 0 4px 12px rgba(0,0,0,0.25)',
        'opacity: 0',
        'transition: opacity 0.3s ease',
        'max-width: 90%',
        'text-align: center'
    ].join(';');

    document.body.appendChild(toast);

    // Trigger fade-in on next frame
    requestAnimationFrame(function () {
        toast.style.opacity = '1';
    });

    // Auto-remove after 3 seconds
    setTimeout(function () {
        toast.style.opacity = '0';
        setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ============================================================================
// Loading Overlay
// ============================================================================

function showLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        return;
    }

    // Create the overlay element if it does not already exist in the DOM
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'background: rgba(255,255,255,0.8)',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'z-index: 9999'
    ].join(';');

    var spinner = document.createElement('div');
    spinner.style.cssText = [
        'width: 48px',
        'height: 48px',
        'border: 4px solid #e0e0e0',
        'border-top-color: #007bff',
        'border-radius: 50%',
        'animation: spin 0.8s linear infinite'
    ].join(';');

    // Inject the spin keyframe animation if not already present
    if (!document.getElementById('loading-spinner-style')) {
        var style = document.createElement('style');
        style.id = 'loading-spinner-style';
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }

    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
}

function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ============================================================================
// Tab Navigation
// ============================================================================

function initNavigation() {
    var navButtons = document.querySelectorAll('.bottom-nav-btn');
    var tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var targetTab = btn.getAttribute('data-tab');

            // Remove active class from all nav buttons
            navButtons.forEach(function (b) {
                b.classList.remove('active');
            });

            // Add active class to clicked button
            btn.classList.add('active');

            // Hide all tab contents, then show the matching one
            tabContents.forEach(function (tc) {
                if (tc.id === 'tab-' + targetTab || tc.id === targetTab || tc.getAttribute('data-tab') === targetTab) {
                    tc.classList.add('active');
                    tc.style.display = '';
                } else {
                    tc.classList.remove('active');
                    tc.style.display = 'none';
                }
            });

            // Call tab-specific init functions
            if (targetTab === 'home') {
                initHome();
            } else if (targetTab === 'dashboard') {
                if (window.DiabetesDashboard && typeof window.DiabetesDashboard.init === 'function') {
                    window.DiabetesDashboard.init();
                }
            }
            // form, questionnaire, and education tabs are already initialized at startup
        });
    });
}

// ============================================================================
// Home Tab Init
// ============================================================================

async function initHome() {
    // Update DB status indicator
    var dotEl = document.getElementById('db-dot');
    var textEl = document.getElementById('db-text');
    if (dotEl && textEl) {
        if (API.dbConnected) {
            dotEl.style.background = '#22c55e';
            textEl.textContent = 'Database Connected';
        } else {
            dotEl.style.background = '#f59e0b';
            textEl.textContent = 'Offline (Local Storage)';
        }
    }

    // Load and display quick stats
    try {
        var summary = await API.getDashboardSummary();

        var totalEl = document.getElementById('home-total');
        var expEl = document.getElementById('home-experimental');
        var ctrlEl = document.getElementById('home-control');

        if (totalEl) totalEl.textContent = summary.totalPatients || summary.total || 0;
        if (expEl) expEl.textContent = summary.experimental || 0;
        if (ctrlEl) ctrlEl.textContent = summary.control || 0;
    } catch (e) {
        console.error('initHome error:', e);
        showToast('Failed to load home stats.', 'error');
    }
}

// ============================================================================
// DOMContentLoaded - App Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async function () {
    showLoading();

    await API.checkStatus();
    initNavigation();
    await initHome();

    // Initialize other modules if they exist
    if (window.DiabetesForm && typeof window.DiabetesForm.init === 'function') {
        window.DiabetesForm.init();
    }
    if (window.DiabetesQuestionnaire && typeof window.DiabetesQuestionnaire.init === 'function') {
        window.DiabetesQuestionnaire.init();
    }
    if (window.DiabetesEducation && typeof window.DiabetesEducation.init === 'function') {
        window.DiabetesEducation.init();
    }

    hideLoading();
});

// ============================================================================
// Expose all public functions and objects on window for global access
// ============================================================================

window.API = API;
window.LocalDB = LocalDB;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.initNavigation = initNavigation;
window.initHome = initHome;
