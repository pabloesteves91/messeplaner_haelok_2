// ========== GLOBAL STATE ==========
let messenData = [];
let currentEditId = null;
let currentCalendarDate = new Date();
let searchQuery = '';
const MAX_MESSEN = 999;
const CHF_TO_EUR_RATE = 1.05;

// ========== HELPER FUNCTIONS ==========
function isMesseArchived(messe) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const messeEnd = new Date(messe.datum_bis);
    messeEnd.setHours(0, 0, 0, 0);
    
    const daysSinceEnd = Math.floor((today - messeEnd) / (1000 * 60 * 60 * 24));
    
    return daysSinceEnd >= 10;
}

function getActiveMessen() {
    return messenData.filter(m => !isMesseArchived(m));
}

function getArchivedMessen() {
    return messenData.filter(m => isMesseArchived(m));
}

// ========== DATA SDK HANDLER ==========
const dataHandler = {
    onDataChanged(data) {
        messenData = data;
        
        renderStats();
        renderMessenListe();
        renderArchivListe();
        renderCalendar();
        updateRechnungWarnings();
        updateLimitWarning();
        renderTaskDashboard();
    }
};

// ========== INIT ==========
async function initApp() {
    // Initialize Data SDK
    const result = await window.dataSdk.init(dataHandler);
    if (!result.isOk) {
        console.error("Failed to initialize Data SDK");
        showToast('Fehler beim Laden der Daten', 'error');
        return;
    }
    
    setupEventListeners();
    updateCurrencyLabels();
    
    // Setup task toggle
    document.getElementById('toggle-tasks').addEventListener('click', () => {
        const content = document.getElementById('task-content');
        const icon = document.getElementById('toggle-icon');
        
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
        } else {
            content.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
        }
    });
}

document.addEventListener('DOMContentLoaded', initApp);

// ========== DATA FUNCTIONS ==========
function calculateTotalCosts(messe) {
    const costs = [
        'stand_kosten', 'strom_kosten', 'wasser_kosten', 'personal_kosten',
        'anreise_kosten', 'unterkunft_kosten', 'marketing_kosten', 'mobiliar_kosten', 'sonstige_kosten'
    ];
    
    let total = 0;
    costs.forEach(field => {
        total += parseFloat(messe[field]) || 0;
    });
    
    return total;
}

function convertToEUR(amount, currency) {
    if (currency === 'CHF') {
        return amount * CHF_TO_EUR_RATE;
    }
    return amount;
}

function formatCurrency(amount, currency = 'EUR') {
    const formatted = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
    return `${formatted} ${currency === 'CHF' ? 'CHF' : 'EUR'}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ========== TASK FUNCTIONS ==========
function getTaskBadges(messe) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const messeStart = new Date(messe.datum_von);
    messeStart.setHours(0, 0, 0, 0);
    
    const messeEnd = new Date(messe.datum_bis);
    messeEnd.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.ceil((messeStart - today) / (1000 * 60 * 60 * 24));
    
    // Check if messe has ended
    const messeEnded = today > messeEnd;
    
    // Check if status is confirmed (check both variants)
    const isConfirmed = messe.status === 'Bestätigt' || messe.status === 'Bestaetigt';
    
    const tasks = [];
    
    // Eigene Erinnerung (falls gesetzt)
    if (messe.eigene_erinnerung_text && messe.eigene_erinnerung_datum) {
        const erinnerungsDatum = new Date(messe.eigene_erinnerung_datum);
        erinnerungsDatum.setHours(0, 0, 0, 0);
        
        const isErledigt = messe.task_eigene_erinnerung_erledigt === 'true';
        
        if (isErledigt) {
            tasks.push({
                label: `✓ Erinnerung: ${messe.eigene_erinnerung_text}`,
                class: 'bg-green-100 text-green-800 line-through'
            });
        } else if (today >= erinnerungsDatum) {
            tasks.push({
                label: `Erinnerung: ${messe.eigene_erinnerung_text}`,
                class: 'bg-fuchsia-100 text-fuchsia-800 border-2 border-fuchsia-500 task-pulse'
            });
        } else {
            tasks.push({
                label: `Erinnerung: ${messe.eigene_erinnerung_text}`,
                class: 'bg-gray-100 text-gray-600'
            });
        }
    }
    
    // Checkliste (4 Wochen = 28 Tage vor Messebeginn) - nur bei bestaetigten Messen
    const checklisteErledigt = messe.task_checkliste_erledigt === 'true';
    if (checklisteErledigt) {
        tasks.push({
            label: '✓ Checkliste',
            class: 'bg-green-100 text-green-800 line-through'
        });
    } else if (daysDiff <= 28 && daysDiff >= 0 && isConfirmed) {
        tasks.push({
            label: 'Checkliste',
            class: 'bg-blue-100 text-blue-800 border-2 border-blue-500 task-pulse'
        });
    } else {
        tasks.push({
            label: 'Checkliste',
            class: 'bg-gray-100 text-gray-600'
        });
    }
    
    // CRM (2 Wochen = 14 Tage vor Messebeginn) - nur bei bestaetigten Messen
    const crmErledigt = messe.task_crm_erledigt === 'true';
    if (crmErledigt) {
        tasks.push({
            label: '✓ CRM',
            class: 'bg-green-100 text-green-800 line-through'
        });
    } else if (daysDiff <= 14 && daysDiff >= 0 && isConfirmed) {
        tasks.push({
            label: 'CRM',
            class: 'bg-orange-100 text-orange-800 border-2 border-orange-500 task-pulse'
        });
    } else {
        tasks.push({
            label: 'CRM',
            class: 'bg-gray-100 text-gray-600'
        });
    }
    
    // LinkedIn Post (1 Woche = 7 Tage vor Messebeginn) - nur bei bestaetigten Messen
    const linkedinErledigt = messe.task_linkedin_erledigt === 'true';
    if (linkedinErledigt) {
        tasks.push({
            label: '✓ LinkedIn Post',
            class: 'bg-green-100 text-green-800 line-through'
        });
    } else if (daysDiff <= 7 && daysDiff >= 0 && isConfirmed) {
        tasks.push({
            label: 'LinkedIn Post',
            class: 'bg-purple-100 text-purple-800 border-2 border-purple-500 task-pulse'
        });
    } else {
        tasks.push({
            label: 'LinkedIn Post',
            class: 'bg-gray-100 text-gray-600'
        });
    }
    
    // Follow Up (Bei Messe Ende - aktiviert wenn Messe vorbei ist) - nur bei bestaetigten Messen
    const followupErledigt = messe.task_followup_erledigt === 'true';
    if (followupErledigt) {
        tasks.push({
            label: '✓ Follow Up',
            class: 'bg-green-100 text-green-800 line-through'
        });
    } else if (messeEnded && isConfirmed) {
        tasks.push({
            label: 'Follow Up',
            class: 'bg-green-100 text-green-800 border-2 border-green-500 task-pulse'
        });
    } else {
        tasks.push({
            label: 'Follow Up',
            class: 'bg-gray-100 text-gray-600'
        });
    }
    
    return `
        <div class="flex flex-wrap gap-2 mb-3">
            ${tasks.map(task => `
                <span class="px-3 py-1.5 rounded-full text-xs font-semibold ${task.class}">
                    ${task.label}
                </span>
            `).join('')}
        </div>
    `;
}

// ========== STATS ==========
function renderStats() {
    const today = new Date();
    const currentYear = 2026;
    const nextYear = 2027;
    
    // Update year labels
    document.getElementById('messen-current-year-label').textContent = currentYear;
    document.getElementById('messen-next-year-label').textContent = nextYear;
    document.getElementById('current-year-label').textContent = currentYear;
    document.getElementById('next-year-label').textContent = nextYear;
    
    // Filter Messen by year (using datum_von)
    const messenCurrentYear = messenData.filter(m => {
        const year = new Date(m.datum_von).getFullYear();
        return year === currentYear;
    });
    
    const messenNextYear = messenData.filter(m => {
        const year = new Date(m.datum_von).getFullYear();
        return year === nextYear;
    });
    
    // Anzahl Messen pro Jahr
    document.getElementById('stat-messen-aktuell').textContent = messenCurrentYear.length;
    document.getElementById('stat-messen-folgejahr').textContent = messenNextYear.length;
    
    // Geschätzte Kosten Aktuelles Jahr (alle Messen des Jahres)
    let totalGeschaetztAktuell = 0;
    messenCurrentYear.forEach(messe => {
        const total = calculateTotalCosts(messe);
        totalGeschaetztAktuell += convertToEUR(total, messe.waehrung);
    });
    const formattedGeschaetztAktuell = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(totalGeschaetztAktuell);
    document.getElementById('stat-kosten-geschaetzt-aktuell').textContent = formattedGeschaetztAktuell + ' EUR';
    
    // Gesamtkosten Aktuelles Jahr (nur bestätigte Messen)
    let totalBestaetigtAktuell = 0;
    messenCurrentYear.forEach(messe => {
        if (messe.status === 'Bestätigt') {
            const total = calculateTotalCosts(messe);
            totalBestaetigtAktuell += convertToEUR(total, messe.waehrung);
        }
    });
    const formattedBestaetigtAktuell = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(totalBestaetigtAktuell);
    document.getElementById('stat-kosten-bestaetigt-aktuell').textContent = formattedBestaetigtAktuell + ' EUR';
    
    // Differenz Aktuelles Jahr
    const differenzAktuell = totalGeschaetztAktuell + totalBestaetigtAktuell;
    const formattedDifferenzAktuell = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Math.abs(differenzAktuell));
    const differenzAktuellEl = document.getElementById('stat-differenz-aktuell');
    if (differenzAktuell > 0) {
        differenzAktuellEl.textContent = '+' + formattedDifferenzAktuell + ' EUR';
        differenzAktuellEl.className = 'text-lg font-bold text-orange-600';
    } else if (differenzAktuell < 0) {
        differenzAktuellEl.textContent = '-' + formattedDifferenzAktuell + ' EUR';
        differenzAktuellEl.className = 'text-lg font-bold text-green-600';
    } else {
        differenzAktuellEl.textContent = formattedDifferenzAktuell + ' EUR';
        differenzAktuellEl.className = 'text-lg font-bold text-gray-700';
    }
    
    // Geschätzte Kosten Folgejahr (alle Messen des Folgejahres)
    let totalGeschaetztFolgejahr = 0;
    messenNextYear.forEach(messe => {
        const total = calculateTotalCosts(messe);
        totalGeschaetztFolgejahr += convertToEUR(total, messe.waehrung);
    });
    const formattedGeschaetztFolgejahr = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(totalGeschaetztFolgejahr);
    document.getElementById('stat-kosten-geschaetzt-folgejahr').textContent = formattedGeschaetztFolgejahr + ' EUR';
    
    // Gesamtkosten Folgejahr (nur bestätigte Messen)
    let totalBestaetigtFolgejahr = 0;
    messenNextYear.forEach(messe => {
        if (messe.status === 'Bestätigt') {
            const total = calculateTotalCosts(messe);
            totalBestaetigtFolgejahr += convertToEUR(total, messe.waehrung);
        }
    });
    const formattedBestaetigtFolgejahr = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(totalBestaetigtFolgejahr);
    document.getElementById('stat-kosten-bestaetigt-folgejahr').textContent = formattedBestaetigtFolgejahr + ' EUR';
    
    // Differenz Folgejahr
    const differenzFolgejahr = totalGeschaetztFolgejahr + totalBestaetigtFolgejahr;
    const formattedDifferenzFolgejahr = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Math.abs(differenzFolgejahr));
    const differenzFolgejahrEl = document.getElementById('stat-differenz-folgejahr');
    if (differenzFolgejahr > 0) {
        differenzFolgejahrEl.textContent = '+' + formattedDifferenzFolgejahr + ' EUR';
        differenzFolgejahrEl.className = 'text-lg font-bold text-orange-600';
    } else if (differenzFolgejahr < 0) {
        differenzFolgejahrEl.textContent = '-' + formattedDifferenzFolgejahr + ' EUR';
        differenzFolgejahrEl.className = 'text-lg font-bold text-green-600';
    } else {
        differenzFolgejahrEl.textContent = formattedDifferenzFolgejahr + ' EUR';
        differenzFolgejahrEl.className = 'text-lg font-bold text-gray-700';
    }
    
    // Naechste Messe (nur nicht-archivierte, zukuenftige Messen)
    const activeMessen = getActiveMessen();
    today.setHours(0, 0, 0, 0);
    
    const futureMessen = activeMessen
        .filter(m => new Date(m.datum_von) >= today)
        .sort((a, b) => new Date(a.datum_von) - new Date(b.datum_von));
    
    if (futureMessen.length > 0) {
        const nextDate = new Date(futureMessen[0].datum_von);
        nextDate.setHours(0, 0, 0, 0);
        const diffTime = nextDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            document.getElementById('stat-naechste').textContent = 'Heute!';
        } else if (diffDays === 1) {
            document.getElementById('stat-naechste').textContent = 'In 1 Tag';
        } else {
            document.getElementById('stat-naechste').textContent = `In ${diffDays} Tagen`;
        }
    } else {
        document.getElementById('stat-naechste').textContent = '-';
    }
}

// ========== RENDER MESSEN LISTE ==========
function renderMessenListe() {
    const container = document.getElementById('messen-liste');
    const emptyState = document.getElementById('empty-state');
    
    let activeMessen = getActiveMessen();
    
    // Apply search filter
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        activeMessen = activeMessen.filter(m => 
            (m.messe_name && m.messe_name.toLowerCase().includes(query)) ||
            (m.standort && m.standort.toLowerCase().includes(query)) ||
            (m.land && m.land.toLowerCase().includes(query)) ||
            (m.verantwortlich && m.verantwortlich.toLowerCase().includes(query)) ||
            (m.branche && m.branche.toLowerCase().includes(query)) ||
            (m.status && m.status.toLowerCase().includes(query))
        );
    }
    
    if (activeMessen.length === 0) {
        emptyState.classList.remove('hidden');
        if (searchQuery.trim()) {
            emptyState.innerHTML = `
                <svg class="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">Keine Messen gefunden</h3>
                <p class="text-gray-500">Versuche einen anderen Suchbegriff</p>
            `;
        } else {
            emptyState.innerHTML = `
                <svg class="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">Noch keine Messen eingetragen</h3>
                <p class="text-gray-500">Fuege deine erste Messe hinzu</p>
            `;
        }
        container.innerHTML = '';
        return;
    }
    
    emptyState.classList.add('hidden');
    
    const sorted = [...activeMessen].sort((a, b) => 
        new Date(a.datum_von) - new Date(b.datum_von)
    );
    
    container.innerHTML = sorted.map(messe => {
        const total = calculateTotalCosts(messe);
        const totalEUR = convertToEUR(total, messe.waehrung);
        const isCHF = messe.waehrung === 'CHF';
        
        const statusColors = {
            'Notiert': 'bg-gray-100 text-gray-800',
            'Angefragt': 'bg-blue-100 text-blue-800',
            'Pendent': 'bg-yellow-100 text-yellow-800',
            'Bestätigt': 'bg-green-100 text-green-800',
            'Bestaetigt': 'bg-green-100 text-green-800',
            'Ausgebucht': 'bg-red-100 text-red-800',
            'Abgelehnt': 'bg-rose-100 text-rose-800',
            'Besucher': 'bg-purple-100 text-purple-800'
        };
        
        const brancheColors = {
            'Construction & Infrastructure': 'bg-amber-100 text-amber-800',
            'Industry': 'bg-blue-100 text-blue-800',
            'Energy & Environment': 'bg-green-100 text-green-800',
            'Mobility & Transportation': 'bg-pink-100 text-pink-800',
            'Research & Hightech': 'bg-violet-100 text-violet-800',
            'Diverse': 'bg-gray-100 text-gray-800'
        };
        
        const rechnungColors = {
            'Ja': 'bg-green-100 text-green-800',
            'Teilweise': 'bg-yellow-100 text-yellow-800',
            'Nein': 'bg-red-100 text-red-800'
        };
        
        const dateiCount = messe.datei_referenzen ? messe.datei_referenzen.split('\n').filter(l => l.trim() && (l.includes('http://') || l.includes('https://'))).length : 0;
        
        return `
            <div class="messe-card glass-card rounded-xl shadow-lg p-5 hover:shadow-xl transition-all cursor-pointer fade-in" data-id="${messe.__backendId}">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">${messe.messe_name}</h3>
                        <p class="text-gray-600 mb-3">
                            ${messe.standort}, ${messe.land} • ${formatDate(messe.datum_von)} - ${formatDate(messe.datum_bis)}
                            ${messe.stand_nummer ? ` • Stand ${messe.stand_nummer}` : ''}
                        </p>
                        <div class="flex flex-wrap gap-2 mb-3">
                            <span class="px-3 py-1 rounded-full text-xs font-medium ${statusColors[messe.status] || 'bg-gray-100 text-gray-800'}">
                                ${messe.status}
                            </span>
                            <span class="px-3 py-1 rounded-full text-xs font-medium ${brancheColors[messe.branche] || 'bg-gray-100 text-gray-800'}">
                                ${messe.branche}
                            </span>
                            <span class="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                ${messe.teilnahme_art}
                            </span>
                            ${isCHF ? '<span class="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">CHF</span>' : ''}
                            ${dateiCount > 0 ? `<span class="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">${dateiCount} Dateien</span>` : ''}
                        </div>
                    </div>
                    <div class="md:text-right">
                        <p class="text-sm text-gray-600 mb-1">Gesamtkosten (in EUR)</p>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrency(totalEUR, 'EUR')}</p>
                        ${isCHF ? '<p class="text-xs text-gray-500 mt-1">Umgerechnet von CHF</p>' : ''}
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-200">
                    <p class="text-sm text-gray-600 mb-3">${messe.verantwortlich}</p>
                    ${getTaskBadges(messe)}
                    <div class="flex justify-end">
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${rechnungColors[messe.rechnung_bezahlt]}">
                            Rechnung: ${messe.rechnung_bezahlt}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click listeners
    document.querySelectorAll('.messe-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            openDetailModal(id);
        });
    });
}

// ========== RECHNUNGS-WARNUNGEN ==========
function updateRechnungWarnings() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeMessen = getActiveMessen();
    
    const overdueMessen = [];
    const upcomingMessen = [];
    const unpaidMessen = [];
    
    activeMessen.forEach(messe => {
        const isConfirmed = messe.status === 'Bestätigt' || messe.status === 'Bestaetigt';
        const isUnpaid = messe.rechnung_bezahlt === 'Nein' || messe.rechnung_bezahlt === 'Teilweise';
        
        if (messe.rechnung_faellig && isUnpaid) {
            const dueDate = new Date(messe.rechnung_faellig);
            dueDate.setHours(0, 0, 0, 0);
            
            const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                overdueMessen.push({ messe, daysOverdue: Math.abs(diffDays) });
            } else if (diffDays <= 7) {
                upcomingMessen.push({ messe, daysLeft: diffDays });
            }
        }
        
        if (isConfirmed && isUnpaid && !messe.rechnung_faellig) {
            unpaidMessen.push(messe);
        }
    });
    
    const warningsContainer = document.getElementById('rechnung-warnings');
    const overdueWarning = document.getElementById('overdue-warning');
    const upcomingWarning = document.getElementById('upcoming-warning');
    const unpaidWarning = document.getElementById('unpaid-warning');
    
    // Show/hide container
    if (overdueMessen.length > 0 || upcomingMessen.length > 0 || unpaidMessen.length > 0) {
        warningsContainer.classList.remove('hidden');
    } else {
        warningsContainer.classList.add('hidden');
        return;
    }
    
    // Überfällige Rechnungen
    if (overdueMessen.length > 0) {
        overdueWarning.classList.remove('hidden');
        document.getElementById('overdue-list').innerHTML = overdueMessen.map(({ messe, daysOverdue }) => `
            <div class="flex items-center justify-between bg-white rounded-lg p-2 border-l-4 border-red-500">
                <div>
                    <p class="text-red-900 font-semibold">${messe.messe_name}</p>
                    <p class="text-red-700 text-sm">Fällig seit ${daysOverdue} ${daysOverdue === 1 ? 'Tag' : 'Tagen'} - ${formatDate(messe.rechnung_faellig)}</p>
                </div>
                <button onclick="openDetailModal('${messe.__backendId}')" class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                    Ansehen
                </button>
            </div>
        `).join('');
    } else {
        overdueWarning.classList.add('hidden');
    }
    
    // Bald fällige Rechnungen
    if (upcomingMessen.length > 0) {
        upcomingWarning.classList.remove('hidden');
        document.getElementById('upcoming-list').innerHTML = upcomingMessen.map(({ messe, daysLeft }) => `
            <div class="flex items-center justify-between bg-white rounded-lg p-2 border-l-4 border-orange-500">
                <div>
                    <p class="text-orange-900 font-semibold">${messe.messe_name}</p>
                    <p class="text-orange-700 text-sm">Fällig in ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tagen'} - ${formatDate(messe.rechnung_faellig)}</p>
                </div>
                <button onclick="openDetailModal('${messe.__backendId}')" class="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">
                    Ansehen
                </button>
            </div>
        `).join('');
    } else {
        upcomingWarning.classList.add('hidden');
    }
    
    // Unbezahlte bestätigte Messen
    if (unpaidMessen.length > 0) {
        unpaidWarning.classList.remove('hidden');
        document.getElementById('unpaid-list').innerHTML = unpaidMessen.map(messe => `
            <div class="flex items-center justify-between bg-white rounded-lg p-2 border-l-4 border-yellow-500">
                <div>
                    <p class="text-yellow-900 font-semibold">${messe.messe_name}</p>
                    <p class="text-yellow-700 text-sm">${formatDate(messe.datum_von)} - ${formatDate(messe.datum_bis)}</p>
                </div>
                <button onclick="openDetailModal('${messe.__backendId}')" class="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">
                    Ansehen
                </button>
            </div>
        `).join('');
    } else {
        unpaidWarning.classList.add('hidden');
    }
}

// ========== TASK DASHBOARD ==========
function renderTaskDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeMessen = getActiveMessen();
    const tasks = [];
    
    activeMessen.forEach(messe => {
        const messeStart = new Date(messe.datum_von);
        messeStart.setHours(0, 0, 0, 0);
        
        const messeEnd = new Date(messe.datum_bis);
        messeEnd.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.ceil((messeStart - today) / (1000 * 60 * 60 * 24));
        const messeEnded = today > messeEnd;
        
        const isConfirmed = messe.status === 'Bestätigt' || messe.status === 'Bestaetigt';
        
        // Eigene Erinnerung
        if (messe.eigene_erinnerung_text && messe.eigene_erinnerung_datum) {
            const erinnerungsDatum = new Date(messe.eigene_erinnerung_datum);
            erinnerungsDatum.setHours(0, 0, 0, 0);
            
            const isErledigt = messe.task_eigene_erinnerung_erledigt === 'true';
            
            if (today >= erinnerungsDatum && !isErledigt) {
                tasks.push({
                    priority: 1,
                    type: 'reminder',
                    taskField: 'task_eigene_erinnerung_erledigt',
                    messe: messe,
                    label: messe.eigene_erinnerung_text,
                    daysInfo: `Erinnerung seit ${formatDate(messe.eigene_erinnerung_datum)}`,
                    icon: 'bell',
                    color: 'fuchsia'
                });
            }
        }
        
        // Checkliste (4 Wochen vor Messebeginn) - nur bestätigte Messen
        const checklisteErledigt = messe.task_checkliste_erledigt === 'true';
        if (daysDiff <= 28 && daysDiff >= 0 && isConfirmed && !checklisteErledigt) {
            tasks.push({
                priority: 2,
                type: 'checklist',
                taskField: 'task_checkliste_erledigt',
                messe: messe,
                label: 'Checkliste durchgehen',
                daysInfo: `Messe in ${daysDiff} ${daysDiff === 1 ? 'Tag' : 'Tagen'}`,
                icon: 'clipboard-check',
                color: 'blue'
            });
        }
        
        // CRM (2 Wochen vor Messebeginn) - nur bestätigte Messen
        const crmErledigt = messe.task_crm_erledigt === 'true';
        if (daysDiff <= 14 && daysDiff >= 0 && isConfirmed && !crmErledigt) {
            tasks.push({
                priority: 3,
                type: 'crm',
                taskField: 'task_crm_erledigt',
                messe: messe,
                label: 'CRM-Einträge vorbereiten',
                daysInfo: `Messe in ${daysDiff} ${daysDiff === 1 ? 'Tag' : 'Tagen'}`,
                icon: 'users',
                color: 'orange'
            });
        }
        
        // LinkedIn Post (1 Woche vor Messebeginn) - nur bestätigte Messen
        const linkedinErledigt = messe.task_linkedin_erledigt === 'true';
        if (daysDiff <= 7 && daysDiff >= 0 && isConfirmed && !linkedinErledigt) {
            tasks.push({
                priority: 4,
                type: 'linkedin',
                taskField: 'task_linkedin_erledigt',
                messe: messe,
                label: 'LinkedIn Post erstellen',
                daysInfo: `Messe in ${daysDiff} ${daysDiff === 1 ? 'Tag' : 'Tagen'}`,
                icon: 'megaphone',
                color: 'purple'
            });
        }
        
        // Follow Up (nach Messeende) - nur bestätigte Messen
        const followupErledigt = messe.task_followup_erledigt === 'true';
        if (messeEnded && isConfirmed && !followupErledigt) {
            const daysSinceEnd = Math.ceil((today - messeEnd) / (1000 * 60 * 60 * 24));
            tasks.push({
                priority: 5,
                type: 'followup',
                taskField: 'task_followup_erledigt',
                messe: messe,
                label: 'Follow-Up durchführen',
                daysInfo: `Messe endete vor ${daysSinceEnd} ${daysSinceEnd === 1 ? 'Tag' : 'Tagen'}`,
                icon: 'mail',
                color: 'green'
            });
        }
    });
    
    // Sort by priority
    tasks.sort((a, b) => a.priority - b.priority);
    
    // Update UI
    const taskList = document.getElementById('task-list');
    const taskEmpty = document.getElementById('task-empty');
    const taskSummary = document.getElementById('task-summary');
    
    if (tasks.length === 0) {
        taskList.classList.add('hidden');
        taskEmpty.classList.remove('hidden');
        taskSummary.textContent = 'Keine aktiven Tasks';
        return;
    }
    
    taskEmpty.classList.add('hidden');
    taskList.classList.remove('hidden');
    taskSummary.textContent = `${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'} zu erledigen`;
    
    const icons = {
        'bell': 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
        'clipboard-check': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
        'users': 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        'megaphone': 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
        'mail': 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
    };
    
    const colorClasses = {
        'fuchsia': { bg: 'bg-fuchsia-500', border: 'border-fuchsia-200', text: 'text-fuchsia-900', bgLight: 'bg-fuchsia-50' },
        'blue': { bg: 'bg-blue-500', border: 'border-blue-200', text: 'text-blue-900', bgLight: 'bg-blue-50' },
        'orange': { bg: 'bg-orange-500', border: 'border-orange-200', text: 'text-orange-900', bgLight: 'bg-orange-50' },
        'purple': { bg: 'bg-purple-500', border: 'border-purple-200', text: 'text-purple-900', bgLight: 'bg-purple-50' },
        'green': { bg: 'bg-green-500', border: 'border-green-200', text: 'text-green-900', bgLight: 'bg-green-50' }
    };
    
    taskList.innerHTML = tasks.map(task => {
        const colors = colorClasses[task.color];
        return `
            <div class="glass-card rounded-xl p-4 hover:shadow-lg transition-all border-l-4 ${colors.border}">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icons[task.icon]}"></path>
                        </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3 mb-2">
                            <div class="flex-1 cursor-pointer" onclick="openDetailModal('${task.messe.__backendId}')">
                                <h3 class="font-bold text-gray-900 text-lg">${task.label}</h3>
                                <p class="text-gray-600 text-sm">${task.messe.messe_name}</p>
                            </div>
                            <span class="px-3 py-1 ${colors.bgLight} ${colors.text} rounded-full text-xs font-semibold whitespace-nowrap">
                                ${task.daysInfo}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 text-sm text-gray-500 mb-3">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            <span>${task.messe.standort}, ${task.messe.land}</span>
                            <span class="mx-2">•</span>
                            <span>${formatDate(task.messe.datum_von)} - ${formatDate(task.messe.datum_bis)}</span>
                            <span class="mx-2">•</span>
                            <span class="font-medium">${task.messe.verantwortlich}</span>
                        </div>
                        <button 
                            class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all flex items-center gap-2"
                            onclick="completeTask('${task.messe.__backendId}', '${task.taskField}', event)"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Als erledigt markieren
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function completeTask(messeId, taskField, event) {
    event.stopPropagation();
    
    const button = event.currentTarget;
    const originalHtml = button.innerHTML;
    
    button.disabled = true;
    button.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Speichere...';
    
    const messe = messenData.find(m => m.__backendId === messeId);
    if (!messe) {
        button.disabled = false;
        button.innerHTML = originalHtml;
        showToast('Messe nicht gefunden', 'error');
        return;
    }
    
    const updatedMesse = { ...messe };
    updatedMesse[taskField] = 'true';
    
    const result = await window.dataSdk.update(updatedMesse);
    
    if (result.isOk) {
        showToast('Task als erledigt markiert! ✓', 'success');
    } else {
        button.disabled = false;
        button.innerHTML = originalHtml;
        showToast('Fehler beim Speichern', 'error');
    }
}

// ========== RENDER ARCHIV LISTE ==========
function renderArchivListe() {
    const container = document.getElementById('archiv-liste');
    const emptyState = document.getElementById('empty-state-archiv');
    
    const archivedMessen = getArchivedMessen();
    
    if (archivedMessen.length === 0) {
        emptyState.classList.remove('hidden');
        container.innerHTML = '';
        return;
    }
    
    emptyState.classList.add('hidden');
    
    const sorted = [...archivedMessen].sort((a, b) => 
        new Date(b.datum_bis) - new Date(a.datum_bis)
    );
    
    container.innerHTML = sorted.map(messe => {
        const total = calculateTotalCosts(messe);
        const totalEUR = convertToEUR(total, messe.waehrung);
        const isCHF = messe.waehrung === 'CHF';
        
        const statusColors = {
            'Notiert': 'bg-gray-100 text-gray-800',
            'Angefragt': 'bg-blue-100 text-blue-800',
            'Pendent': 'bg-yellow-100 text-yellow-800',
            'Bestätigt': 'bg-green-100 text-green-800',
            'Bestaetigt': 'bg-green-100 text-green-800',
            'Ausgebucht': 'bg-red-100 text-red-800',
            'Abgelehnt': 'bg-rose-100 text-rose-800',
            'Besucher': 'bg-purple-100 text-purple-800'
        };
        
        const brancheColors = {
            'Construction & Infrastructure': 'bg-amber-100 text-amber-800',
            'Industry': 'bg-blue-100 text-blue-800',
            'Energy & Environment': 'bg-green-100 text-green-800',
            'Mobility & Transportation': 'bg-pink-100 text-pink-800',
            'Research & Hightech': 'bg-violet-100 text-violet-800',
            'Diverse': 'bg-gray-100 text-gray-800'
        };
        
        const rechnungColors = {
            'Ja': 'bg-green-100 text-green-800',
            'Teilweise': 'bg-yellow-100 text-yellow-800',
            'Nein': 'bg-red-100 text-red-800'
        };
        
        const dateiCount = messe.datei_referenzen ? messe.datei_referenzen.split('\n').filter(l => l.trim() && (l.includes('http://') || l.includes('https://'))).length : 0;
        
        return `
            <div class="messe-card glass-card rounded-xl shadow-lg p-5 hover:shadow-xl transition-all cursor-pointer fade-in opacity-75" data-id="${messe.__backendId}">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h3 class="text-xl font-bold text-gray-900">${messe.messe_name}</h3>
                            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                                Archiviert
                            </span>
                        </div>
                        <p class="text-gray-600 mb-3">
                            ${messe.standort}, ${messe.land} • ${formatDate(messe.datum_von)} - ${formatDate(messe.datum_bis)}
                            ${messe.stand_nummer ? ` • Stand ${messe.stand_nummer}` : ''}
                        </p>
                        <div class="flex flex-wrap gap-2 mb-3">
                            <span class="px-3 py-1 rounded-full text-xs font-medium ${statusColors[messe.status] || 'bg-gray-100 text-gray-800'}">
                                ${messe.status}
                            </span>
                            <span class="px-3 py-1 rounded-full text-xs font-medium ${brancheColors[messe.branche] || 'bg-gray-100 text-gray-800'}">
                                ${messe.branche}
                            </span>
                            <span class="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                ${messe.teilnahme_art}
                            </span>
                            ${isCHF ? '<span class="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">CHF</span>' : ''}
                            ${dateiCount > 0 ? `<span class="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">${dateiCount} Dateien</span>` : ''}
                        </div>
                    </div>
                    <div class="md:text-right">
                        <p class="text-sm text-gray-600 mb-1">Gesamtkosten (in EUR)</p>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrency(totalEUR, 'EUR')}</p>
                        ${isCHF ? '<p class="text-xs text-gray-500 mt-1">Umgerechnet von CHF</p>' : ''}
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-200">
                    <p class="text-sm text-gray-600 mb-3">${messe.verantwortlich}</p>
                    <div class="flex justify-end">
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${rechnungColors[messe.rechnung_bezahlt]}">
                            Rechnung: ${messe.rechnung_bezahlt}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click listeners
    document.querySelectorAll('#archiv-liste .messe-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            openDetailModal(id);
        });
    });
}

// ========== RENDER CALENDAR ==========
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update header
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    document.getElementById('current-month-year').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust for Monday start (0 = Sunday, 1 = Monday, etc.)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    // Get messen for this month
    const monthMessen = messenData.filter(m => {
        const start = new Date(m.datum_von);
        const end = new Date(m.datum_bis);
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        
        // Check if messe overlaps with this month
        return (start <= monthEnd && end >= monthStart);
    });
    
    const grid = document.getElementById('calendar-grid');
    let html = '';
    
    // Day headers
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    dayNames.forEach(day => {
        html += `<div class="text-center font-bold text-gray-700 py-2">${day}</div>`;
    });
    
    // Empty cells before first day
    for (let i = 0; i < adjustedFirstDay; i++) {
        html += '<div class="bg-gray-50 rounded-lg p-2 min-h-24"></div>';
    }
    
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayMessen = monthMessen.filter(m => {
            const start = new Date(m.datum_von);
            const end = new Date(m.datum_bis);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            currentDate.setHours(0, 0, 0, 0);
            
            return currentDate >= start && currentDate <= end;
        });
        
        const isToday = new Date().toDateString() === currentDate.toDateString();
        
        html += `
            <div class="bg-white rounded-lg p-2 min-h-24 border ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'} hover:shadow-md transition-all">
                <div class="font-semibold text-gray-700 mb-1">${day}</div>
                <div class="space-y-1">
                    ${dayMessen.map(m => {
                        const isConfirmed = m.status === 'Bestätigt' || m.status === 'Bestaetigt';
                        const isPlanned = m.status === 'Angefragt' || m.status === 'Pendent';
                        const color = isConfirmed ? 'bg-green-500' : (isPlanned ? 'bg-blue-500' : 'bg-gray-400');
                        
                        return `
                            <div 
                                class="${color} text-white text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-all truncate"
                                onclick="openDetailModal('${m.__backendId}')"
                                title="${m.messe_name}"
                            >
                                ${m.messe_name.substring(0, 15)}${m.messe_name.length > 15 ? '...' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    grid.innerHTML = html;
}

// ========== DETAIL MODAL ==========
function openDetailModal(id) {
    const messe = messenData.find(m => m.__backendId === id);
    if (!messe) return;
    
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('modal-title');
    const content = document.getElementById('modal-content');
    
    title.textContent = messe.messe_name;
    
    const total = calculateTotalCosts(messe);
    const totalEUR = convertToEUR(total, messe.waehrung);
    const isCHF = messe.waehrung === 'CHF';
    
    const statusColors = {
        'Notiert': 'bg-gray-100 text-gray-800',
        'Angefragt': 'bg-blue-100 text-blue-800',
        'Pendent': 'bg-yellow-100 text-yellow-800',
        'Bestätigt': 'bg-green-100 text-green-800',
        'Bestaetigt': 'bg-green-100 text-green-800',
        'Ausgebucht': 'bg-red-100 text-red-800',
        'Abgelehnt': 'bg-rose-100 text-rose-800',
        'Besucher': 'bg-purple-100 text-purple-800'
    };
    
    const brancheColors = {
        'Construction & Infrastructure': 'bg-amber-100 text-amber-800',
        'Industry': 'bg-blue-100 text-blue-800',
        'Energy & Environment': 'bg-green-100 text-green-800',
        'Mobility & Transportation': 'bg-pink-100 text-pink-800',
        'Research & Hightech': 'bg-violet-100 text-violet-800',
        'Diverse': 'bg-gray-100 text-gray-800'
    };
    
    const rechnungColors = {
        'Ja': 'bg-green-100 text-green-800',
        'Teilweise': 'bg-yellow-100 text-yellow-800',
        'Nein': 'bg-red-100 text-red-800'
    };
    
    const links = parseFileLinks(messe.datei_referenzen || '');
    
    let html = '';
    
    // Messe Link Button
    if (messe.messe_link) {
        html += `
            <div class="mb-6">
                <a href="${messe.messe_link}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                    Messe-Website besuchen
                </a>
            </div>
        `;
    }
    
    // Dateien Block
    if (links.length > 0) {
        html += `
            <div class="mb-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    Dateien & Dokumente (${links.length})
                </h4>
                <div class="space-y-2">
                    ${links.map(link => `
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="link-card flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400">
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                                <svg class="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <div class="min-w-0 flex-1">
                                    <p class="font-medium text-gray-900">${link.title}</p>
                                    <p class="text-sm text-gray-500 truncate">${link.url}</p>
                                </div>
                            </div>
                            <svg class="w-5 h-5 text-indigo-600 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Grid Infos
    html += `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
                <p class="text-sm text-gray-600 mb-1">Status</p>
                <span class="inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[messe.status]}">
                    ${messe.status}
                </span>
            </div>
            <div>
                <p class="text-sm text-gray-600 mb-1">Branche</p>
                <span class="inline-block px-3 py-1 rounded-full text-sm font-medium ${brancheColors[messe.branche]}">
                    ${messe.branche}
                </span>
            </div>
            <div>
                <p class="text-sm text-gray-600 mb-1">Standort</p>
                <p class="font-medium text-gray-900">${messe.standort}, ${messe.land}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600 mb-1">Zeitraum</p>
                <p class="font-medium text-gray-900">${formatDate(messe.datum_von)} - ${formatDate(messe.datum_bis)}</p>
            </div>
            ${messe.stand_nummer || messe.stand_groesse ? `
                <div>
                    <p class="text-sm text-gray-600 mb-1">Stand</p>
                    <p class="font-medium text-gray-900">
                        ${messe.stand_nummer ? `Nr. ${messe.stand_nummer}` : ''}
                        ${messe.stand_nummer && messe.stand_groesse ? ' • ' : ''}
                        ${messe.stand_groesse ? `${messe.stand_groesse} qm` : ''}
                    </p>
                </div>
            ` : ''}
            <div>
                <p class="text-sm text-gray-600 mb-1">Teilnahme als</p>
                <span class="inline-block px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    ${messe.teilnahme_art}
                </span>
            </div>
        </div>
    `;
    
    // Verantwortlich, Waehrung & Personal
    html += `
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 class="font-semibold text-gray-900 mb-3">Organisation</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600 mb-1">Verantwortlich</p>
                    <p class="font-medium text-gray-900">${messe.verantwortlich}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600 mb-1">Waehrung</p>
                    <p class="font-medium text-gray-900">${messe.waehrung} ${isCHF ? '(Wechselkurs: 1 CHF = 1.05 EUR)' : ''}</p>
                </div>
                ${messe.personal_anzahl ? `
                    <div>
                        <p class="text-sm text-gray-600 mb-1">Anzahl Personal</p>
                        <p class="font-medium text-gray-900">${messe.personal_anzahl} ${parseInt(messe.personal_anzahl) === 1 ? 'Person' : 'Personen'}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Ansprechsperson
    if (messe.ansprechperson_name || messe.ansprechperson_email || messe.ansprechperson_telefon) {
        html += `
            <div class="bg-blue-50 rounded-lg p-4 mb-6">
                <h4 class="font-semibold text-gray-900 mb-3">Ansprechsperson</h4>
                <div class="space-y-2">
                    ${messe.ansprechperson_name ? `<p class="text-gray-900"><span class="text-gray-600 text-sm">Name:</span> <span class="font-medium">${messe.ansprechperson_name}</span></p>` : ''}
                    ${messe.ansprechperson_email ? `<p><span class="text-gray-600 text-sm">E-Mail:</span> <a href="mailto:${messe.ansprechperson_email}" class="text-blue-600 hover:underline font-medium">${messe.ansprechperson_email}</a></p>` : ''}
                    ${messe.ansprechperson_telefon ? `<p><span class="text-gray-600 text-sm">Telefon:</span> <a href="tel:${messe.ansprechperson_telefon}" class="text-blue-600 hover:underline font-medium">${messe.ansprechperson_telefon}</a></p>` : ''}
                </div>
            </div>
        `;
    }
    
    // Rechnung & Zahlung
    html += `
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 class="font-semibold text-gray-900 mb-3">Rechnung & Zahlung</h4>
            <div class="flex flex-wrap items-center gap-3">
                <span class="px-3 py-1 rounded-full text-sm font-medium ${rechnungColors[messe.rechnung_bezahlt]}">
                    ${messe.rechnung_bezahlt}
                </span>
                ${messe.rechnung_faellig ? `<span class="text-sm text-gray-600">Faellig per: <span class="font-medium">${formatDate(messe.rechnung_faellig)}</span></span>` : ''}
            </div>
        </div>
    `;
    
    // Kostenübersicht
    html += `
        <div class="bg-green-50 rounded-lg p-4 mb-6">
            <h4 class="font-semibold text-gray-900 mb-3">Kostenuebersicht</h4>
            <div class="space-y-2 text-sm">
                ${messe.stand_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Standmiete:</span><span class="font-medium">${formatCurrency(parseFloat(messe.stand_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.strom_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Strom:</span><span class="font-medium">${formatCurrency(parseFloat(messe.strom_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.wasser_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Wasser:</span><span class="font-medium">${formatCurrency(parseFloat(messe.wasser_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.marketing_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Marketing:</span><span class="font-medium">${formatCurrency(parseFloat(messe.marketing_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.mobiliar_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Mobiliar:</span><span class="font-medium">${formatCurrency(parseFloat(messe.mobiliar_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.personal_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Personal:</span><span class="font-medium">${formatCurrency(parseFloat(messe.personal_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.anreise_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Anreise:</span><span class="font-medium">${formatCurrency(parseFloat(messe.anreise_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.unterkunft_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Unterkunft:</span><span class="font-medium">${formatCurrency(parseFloat(messe.unterkunft_kosten), messe.waehrung)}</span></div>` : ''}
                ${messe.sonstige_kosten ? `<div class="flex justify-between"><span class="text-gray-600">Sonstige:</span><span class="font-medium">${formatCurrency(parseFloat(messe.sonstige_kosten), messe.waehrung)}</span></div>` : ''}
                <div class="border-t border-green-200 pt-2 mt-2">
                    <div class="flex justify-between font-bold text-base">
                        <span>Gesamt (${messe.waehrung}):</span>
                        <span>${formatCurrency(total, messe.waehrung)}</span>
                    </div>
                    ${isCHF ? `
                        <div class="flex justify-between font-bold text-base text-green-700 mt-1">
                            <span>Gesamt (EUR):</span>
                            <span>${formatCurrency(totalEUR, 'EUR')}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    // Produkte
    if (messe.produkt_preise) {
        html += `
            <div class="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 class="font-semibold text-gray-900 mb-3">Produkte & Preise</h4>
                <p class="text-gray-700 whitespace-pre-wrap">${messe.produkt_preise}</p>
            </div>
        `;
    }
    
    // Notizen
    if (messe.notizen) {
        html += `
            <div class="bg-yellow-50 rounded-lg p-4 mb-6">
                <h4 class="font-semibold text-gray-900 mb-3">Notizen</h4>
                <p class="text-gray-700 whitespace-pre-wrap">${messe.notizen}</p>
            </div>
        `;
    }
    
    // Eigene Erinnerung
    if (messe.eigene_erinnerung_text && messe.eigene_erinnerung_datum) {
        const erinnerungsDatum = new Date(messe.eigene_erinnerung_datum);
        const isActive = new Date() >= erinnerungsDatum;
        
        html += `
            <div class="bg-purple-50 rounded-lg p-4 ${isActive ? 'border-2 border-purple-500' : ''}">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    Eigene Erinnerung
                    ${isActive ? '<span class="ml-2 px-2 py-1 text-xs bg-purple-600 text-white rounded-full">Aktiv</span>' : ''}
                </h4>
                <div class="space-y-2">
                    <p class="text-gray-900"><span class="font-semibold">Erinnerung:</span> ${messe.eigene_erinnerung_text}</p>
                    <p class="text-gray-600 text-sm">Datum: ${formatDate(messe.eigene_erinnerung_datum)}</p>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Set up modal buttons
    document.getElementById('modal-delete-btn').onclick = () => confirmDelete(id);
    document.getElementById('modal-edit-btn').onclick = () => editMesse(id);
    document.getElementById('modal-close-btn').onclick = closeDetailModal;
    document.getElementById('modal-backdrop').onclick = closeDetailModal;
    
    // Show template button only for archived messen
    const templateBtn = document.getElementById('modal-template-btn');
    if (isMesseArchived(messe)) {
        templateBtn.classList.remove('hidden');
        templateBtn.onclick = () => useAsTemplate(id);
    } else {
        templateBtn.classList.add('hidden');
    }
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function useAsTemplate(id) {
    const messe = messenData.find(m => m.__backendId === id);
    if (!messe) return;
    
    // Fill form with template data
    const form = document.getElementById('messe-form');
    Object.keys(messe).forEach(key => {
        if (key === '__backendId' || key === 'type') return;
        // Skip date fields - they should be empty for new entry
        if (key === 'datum_von' || key === 'datum_bis' || key === 'rechnung_faellig' || key === 'eigene_erinnerung_datum') return;
        
        const input = form.elements[key];
        if (input) {
            input.value = messe[key] || '';
        }
    });
    
    // Update currency labels
    updateCurrencyLabels();
    
    // Update link preview
    updateLinkPreview();
    
    // Switch to form tab
    switchTab('neu');
    closeDetailModal();
    
    showToast('Vorlage geladen - bitte Datum ergänzen', 'success');
}

function confirmDelete(id) {
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn.textContent === 'Wirklich loeschen?') {
        deleteMesse(id);
    } else {
        deleteBtn.textContent = 'Wirklich loeschen?';
        deleteBtn.classList.add('bg-red-700');
        setTimeout(() => {
            deleteBtn.textContent = 'Loeschen';
            deleteBtn.classList.remove('bg-red-700');
        }, 3000);
    }
}

async function deleteMesse(id) {
    const messe = messenData.find(m => m.__backendId === id);
    if (!messe) return;
    
    const deleteBtn = document.getElementById('modal-delete-btn');
    const originalText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    
    const result = await window.dataSdk.delete(messe);
    
    deleteBtn.disabled = false;
    deleteBtn.textContent = originalText;
    
    if (result.isOk) {
        closeDetailModal();
        showToast('Messe erfolgreich geloescht', 'success');
    } else {
        showToast('Fehler beim Loeschen', 'error');
    }
}

function editMesse(id) {
    const messe = messenData.find(m => m.__backendId === id);
    if (!messe) return;
    
    currentEditId = id;
    
    // Fill form
    const form = document.getElementById('messe-form');
    Object.keys(messe).forEach(key => {
        if (key === '__backendId' || key === 'type') return;
        const input = form.elements[key];
        if (input) {
            input.value = messe[key] || '';
        }
    });
    
    // Update currency labels
    updateCurrencyLabels();
    
    // Update link preview
    updateLinkPreview();
    
    // Change button text
    document.getElementById('submit-text').textContent = 'Änderungen speichern';
    
    // Switch to form tab
    switchTab('neu');
    closeDetailModal();
}

// ========== FORM HANDLING ==========
function setupEventListeners() {
    // Tab switching
    document.getElementById('tab-liste').addEventListener('click', () => switchTab('liste'));
    document.getElementById('tab-kalender').addEventListener('click', () => switchTab('kalender'));
    document.getElementById('tab-neu').addEventListener('click', () => switchTab('neu'));
    document.getElementById('tab-archiv').addEventListener('click', () => switchTab('archiv'));
    
    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
    
    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderMessenListe();
    });
    
    // Form submission
    document.getElementById('messe-form').addEventListener('submit', handleFormSubmit);
    
    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
        if (currentEditId) {
            currentEditId = null;
            document.getElementById('submit-text').textContent = 'Messe speichern';
        }
        document.getElementById('messe-form').reset();
        updateCurrencyLabels();
        updateLinkPreview();
        switchTab('liste');
    });
    
    // Currency change
    document.querySelector('[name="waehrung"]').addEventListener('change', updateCurrencyLabels);
    
    // Link preview
    document.getElementById('datei_referenzen').addEventListener('input', updateLinkPreview);
    
    // Export buttons
    document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);
    document.getElementById('export-excel-btn').addEventListener('click', exportExcel);
    
    // Data backup buttons
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('import-data-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    // Create hidden file input for import
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    fileInput.accept = '.json,.txt';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileImport);
    document.body.appendChild(fileInput);
}

function switchTab(tab) {
    const tabListe = document.getElementById('tab-liste');
    const tabKalender = document.getElementById('tab-kalender');
    const tabNeu = document.getElementById('tab-neu');
    const tabArchiv = document.getElementById('tab-archiv');
    const contentListe = document.getElementById('content-liste');
    const contentKalender = document.getElementById('content-kalender');
    const contentNeu = document.getElementById('content-neu');
    const contentArchiv = document.getElementById('content-archiv');
    
    // Reset all tabs
    [tabListe, tabKalender, tabNeu, tabArchiv].forEach(t => {
        t.classList.remove('text-gray-900', 'border-blue-600');
        t.classList.add('text-gray-500', 'border-transparent');
    });
    
    [contentListe, contentKalender, contentNeu, contentArchiv].forEach(c => {
        c.classList.add('hidden');
    });
    
    // Activate selected tab
    if (tab === 'liste') {
        tabListe.classList.add('text-gray-900', 'border-blue-600');
        tabListe.classList.remove('text-gray-500', 'border-transparent');
        contentListe.classList.remove('hidden');
    } else if (tab === 'kalender') {
        tabKalender.classList.add('text-gray-900', 'border-blue-600');
        tabKalender.classList.remove('text-gray-500', 'border-transparent');
        contentKalender.classList.remove('hidden');
        renderCalendar();
    } else if (tab === 'neu') {
        tabNeu.classList.add('text-gray-900', 'border-blue-600');
        tabNeu.classList.remove('text-gray-500', 'border-transparent');
        contentNeu.classList.remove('hidden');
        
        // Reset form if not editing
        if (!currentEditId) {
            document.getElementById('messe-form').reset();
            updateCurrencyLabels();
            updateLinkPreview();
        }
    } else if (tab === 'archiv') {
        tabArchiv.classList.add('text-gray-900', 'border-blue-600');
        tabArchiv.classList.remove('text-gray-500', 'border-transparent');
        contentArchiv.classList.remove('hidden');
    }
}

function updateCurrencyLabels() {
    const currency = document.querySelector('[name="waehrung"]').value;
    const labels = ['stand', 'strom', 'wasser', 'marketing', 'mobiliar', 'personal', 'mobiliar', 'anreise', 'unterkunft', 'sonstige'];
    labels.forEach(label => {
        const el = document.getElementById(`${label}-currency`);
        if (el) el.textContent = `(${currency})`;
    });
}

function updateLinkPreview() {
    const textarea = document.getElementById('datei_referenzen');
    const preview = document.getElementById('link-preview');
    const links = parseFileLinks(textarea.value);
    
    if (links.length === 0) {
        preview.innerHTML = '';
        return;
    }
    
    preview.innerHTML = `
        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                Vorschau (${links.length} ${links.length === 1 ? 'Link' : 'Links'})
            </h4>
            <div class="space-y-2">
                ${links.map(link => `
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="link-card flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <svg class="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <div class="min-w-0 flex-1">
                                <p class="font-medium text-gray-900">${link.title}</p>
                                <p class="text-sm text-gray-500 truncate">${link.url}</p>
                            </div>
                        </div>
                        <svg class="w-5 h-5 text-indigo-600 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
}

function parseFileLinks(text) {
    if (!text) return [];
    
    const lines = text.split('\n').filter(l => l.trim());
    const links = [];
    
    lines.forEach(line => {
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            const url = urlMatch[0];
            let title = line.replace(url, '').trim();
            
            if (!title) {
                const pathParts = url.split('/');
                title = pathParts[pathParts.length - 1] || 'Dokument oeffnen';
            }
            
            links.push({ url, title });
        }
    });
    
    return links;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Check limit for new messen
    if (!currentEditId && messenData.length >= MAX_MESSEN) {
        showToast('Maximale Anzahl von 999 Messen erreicht', 'warning');
        return;
    }
    
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitSpinner = document.getElementById('submit-spinner');
    
    // Show loading state
    submitBtn.disabled = true;
    submitSpinner.classList.remove('hidden');
    
    const formData = new FormData(e.target);
    const data = { type: 'messe' };
    
    formData.forEach((value, key) => {
        // Convert empty strings to empty string, keep all values as strings
        data[key] = value || '';
    });
    
    let result;
    
    if (currentEditId) {
        // Update existing
        const existingMesse = messenData.find(m => m.__backendId === currentEditId);
        if (existingMesse) {
            const updatedMesse = { ...existingMesse, ...data };
            result = await window.dataSdk.update(updatedMesse);
            
            if (result.isOk) {
                showToast('Messe erfolgreich aktualisiert', 'success');
            } else {
                showToast('Fehler beim Aktualisieren: ' + (result.error.message || 'Unbekannter Fehler'), 'error');
                console.error('Update error:', result.error);
            }
        }
        currentEditId = null;
        submitText.textContent = 'Messe speichern';
    } else {
        // Create new
        result = await window.dataSdk.create(data);
        
        if (result.isOk) {
            showToast('Messe erfolgreich gespeichert', 'success');
        } else {
            showToast('Fehler beim Speichern: ' + (result.error.message || 'Unbekannter Fehler'), 'error');
            console.error('Create error:', result.error);
        }
    }
    
    if (result && result.isOk) {
        e.target.reset();
        updateCurrencyLabels();
        updateLinkPreview();
        switchTab('liste');
    }
    
    // Reset loading state
    submitBtn.disabled = false;
    submitSpinner.classList.add('hidden');
}

function updateLimitWarning() {
    const warning = document.getElementById('limit-warning');
    if (messenData.length >= MAX_MESSEN) {
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
}

// ========== EXPORT ==========
function exportData() {
    if (messenData.length === 0) {
        showToast('Keine Daten zum Sichern vorhanden', 'warning');
        return;
    }
    
    try {
        const exportDate = new Date().toISOString();
        const backup = {
            version: '1.0',
            exportDate: exportDate,
            recordCount: messenData.length,
            data: messenData
        };
        
        const jsonStr = JSON.stringify(backup, null, 2);
        
        // Create blob and download
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `haelok-messeplaner-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast(`Backup mit ${messenData.length} Messen erstellt`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Fehler beim Export', 'error');
    }
}

async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Reset file input
    event.target.value = '';
    
    try {
        const text = await file.text();
        
        // Try to parse JSON
        let backup;
        try {
            backup = JSON.parse(text);
        } catch (parseError) {
            showToast('Ungültige JSON-Datei', 'error');
            return;
        }
        
        // Validate backup structure
        if (!backup.data || !Array.isArray(backup.data)) {
            showToast('Ungültiges Backup-Format', 'error');
            return;
        }
        
        // Check for duplicate IDs
        const existingIds = new Set(messenData.map(m => m.__backendId));
        const newData = backup.data.filter(item => !existingIds.has(item.__backendId));
        
        if (newData.length === 0) {
            showToast('Keine neuen Daten zum Importieren', 'warning');
            return;
        }
        
        // Import each record
        let successCount = 0;
        let errorCount = 0;
        
        for (const record of newData) {
            const result = await window.dataSdk.create(record);
            if (result.isOk) {
                successCount++;
            } else {
                errorCount++;
            }
        }
        
        if (errorCount === 0) {
            showToast(`${successCount} Messen erfolgreich importiert`, 'success');
        } else {
            showToast(`${successCount} erfolgreich, ${errorCount} fehlgeschlagen`, 'warning');
        }
        
    } catch (error) {
        console.error('Import error:', error);
        showToast('Fehler beim Importieren', 'error');
    }
}

function exportPDF() {
    if (messenData.length === 0) {
        showToast('Keine Daten für PDF Export', 'warning');
        return;
    }

    // Erstelle temporäre HTML für den Druck/PDF
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('de-DE');

    const isConfirmedStatus = (messe) => messe.status === 'Bestätigt' || messe.status === 'Bestaetigt';

    // Offene Rechnungen sollen nur bei bestätigten Messen zählen
    const offeneRechnungenBestaetigtCount = messenData.filter(m => isConfirmedStatus(m) && m.rechnung_bezahlt === 'Nein').length;

    // Bestätigte Kosten (nur bestätigte Messen)
    let totalBestaetigteKostenEUR = 0;
    messenData.forEach(m => {
        if (isConfirmedStatus(m)) {
            const total = calculateTotalCosts(m);
            totalBestaetigteKostenEUR += convertToEUR(total, m.waehrung);
        }
    });

    const formattedBestaetigteKostenEUR = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(totalBestaetigteKostenEUR);

    let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Haelok Messeplaner Export - ${today}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #1e3a5f; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
                h2 { color: #374151; margin-top: 25px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background-color: #3b82f6; color: white; padding: 10px; text-align: left; }
                td { padding: 8px; border: 1px solid #ddd; }
                tr:nth-child(even) { background-color: #f9fafb; }
                .total { font-weight: bold; background-color: #d1fae5; }
                .section { margin-bottom: 30px; }
                @media print {
                    .no-print { display: none; }
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <h1>📋 Haelok Messeplaner - Export ${today}</h1>
            <p>Exportiert am: ${today} | Anzahl Messen: ${messenData.length}</p>
            
            <div class="section">
                <h2>📊 Zusammenfassung</h2>
                <table>
                    <tr><th>Statistik</th><th>Wert</th></tr>
                    <tr><td>Aktive Messen</td><td>${getActiveMessen().length}</td></tr>
                    <tr><td>Archivierte Messen</td><td>${getArchivedMessen().length}</td></tr>
                    <tr><td>Bestätigte Messen</td><td>${messenData.filter(m => isConfirmedStatus(m)).length}</td></tr>
                    <tr><td>Offene Rechnungen (nur bestätigt)</td><td>${offeneRechnungenBestaetigtCount}</td></tr>
                    <tr><td>Bestätigte Kosten (EUR)</td><td>${formattedBestaetigteKostenEUR} EUR</td></tr>
                </table>
            </div>
            
            <div class="section">
                <h2>📅 Aktive Messen (${getActiveMessen().length})</h2>
                <table>
                    <tr>
                        <th>Messename</th>
                        <th>Datum</th>
                        <th>Standort</th>
                        <th>Status</th>
                        <th>Kosten (EUR)</th>
                        <th>Bestätigte Kosten (EUR)</th>
                        <th>Verantwortlich</th>
                    </tr>
    `;

    // Aktive Messen
    getActiveMessen().sort((a,b) => new Date(a.datum_von) - new Date(b.datum_von))
        .forEach(messe => {
            const total = calculateTotalCosts(messe);
            const totalEUR = convertToEUR(total, messe.waehrung);
            const confirmedEUR = isConfirmedStatus(messe) ? totalEUR : null;

            htmlContent += `
                <tr>
                    <td>${messe.messe_name}</td>
                    <td>${formatDate(messe.datum_von)} - ${formatDate(messe.datum_bis)}</td>
                    <td>${messe.standort}, ${messe.land}</td>
                    <td>${messe.status}</td>
                    <td>${formatCurrency(totalEUR, 'EUR')}</td>
                    <td>${confirmedEUR !== null ? formatCurrency(confirmedEUR, 'EUR') : '-'}</td>
                    <td>${messe.verantwortlich}</td>
                </tr>
            `;
        });

    htmlContent += `
                </table>
            </div>
            
            <div class="section">
                <h2>💰 Kostenübersicht</h2>
                <table>
                    <tr><th>Kategorie</th><th>Anzahl</th><th>Gesamtkosten (EUR)</th><th>Bestätigte Kosten (EUR)</th></tr>
    `;

    // Kostenstatistik
    const kostenStatistik = {
        'Bestätigte Messen': { count: 0, kosten: 0, bestaetigt: 0 },
        'Alle Messen': { count: messenData.length, kosten: 0, bestaetigt: 0 },
        'Aktive Messen': { count: getActiveMessen().length, kosten: 0, bestaetigt: 0 }
    };

    messenData.forEach(messe => {
        const total = calculateTotalCosts(messe);
        const totalEUR = convertToEUR(total, messe.waehrung);
        const confirmed = isConfirmedStatus(messe);

        kostenStatistik['Alle Messen'].kosten += totalEUR;
        if (confirmed) kostenStatistik['Alle Messen'].bestaetigt += totalEUR;

        if (confirmed) {
            kostenStatistik['Bestätigte Messen'].count++;
            kostenStatistik['Bestätigte Messen'].kosten += totalEUR;
            kostenStatistik['Bestätigte Messen'].bestaetigt += totalEUR;
        }

        if (!isMesseArchived(messe)) {
            kostenStatistik['Aktive Messen'].kosten += totalEUR;
            if (confirmed) kostenStatistik['Aktive Messen'].bestaetigt += totalEUR;
        }
    });

    Object.entries(kostenStatistik).forEach(([kategorie, data]) => {
        htmlContent += `
            <tr>
                <td>${kategorie}</td>
                <td>${data.count}</td>
                <td>${formatCurrency(data.kosten, 'EUR')}</td>
                <td>${formatCurrency(data.bestaetigt, 'EUR')}</td>
            </tr>
        `;
    });

    htmlContent += `
                </table>
            </div>
            
            <div class="section">
                <h2>📋 Komplette Liste aller Messen</h2>
                <table>
                    <tr>
                        <th>ID</th>
                        <th>Messename</th>
                        <th>Datum</th>
                        <th>Ort</th>
                        <th>Branche</th>
                        <th>Status</th>
                        <th>Rechnung</th>
                        <th>Kosten (EUR)</th>
                        <th>Bestätigte Kosten (EUR)</th>
                    </tr>
    `;

    // Komplette Liste
    messenData.sort((a,b) => new Date(a.datum_von) - new Date(b.datum_von))
        .forEach((messe, index) => {
            const total = calculateTotalCosts(messe);
            const totalEUR = convertToEUR(total, messe.waehrung);
            const confirmedEUR = isConfirmedStatus(messe) ? totalEUR : null;
            const isArchived = isMesseArchived(messe);

            htmlContent += `
                <tr style="${isArchived ? 'opacity: 0.7;' : ''}">
                    <td>${index + 1}</td>
                    <td>${messe.messe_name}${isArchived ? ' (Archiv)' : ''}</td>
                    <td>${formatDate(messe.datum_von)}<br>${formatDate(messe.datum_bis)}</td>
                    <td>${messe.standort}<br>${messe.land}</td>
                    <td>${messe.branche}</td>
                    <td>${messe.status}</td>
                    <td>${messe.rechnung_bezahlt}</td>
                    <td>${formatCurrency(totalEUR, 'EUR')}</td>
                    <td>${confirmedEUR !== null ? formatCurrency(confirmedEUR, 'EUR') : '-'}</td>
                </tr>
            `;
        });

    htmlContent += `
                </table>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ccc; text-align: center;">
                <p>Export generiert am: ${new Date().toLocaleString('de-DE')}</p>
                <p>© Haelok Messeplaner - ${new Date().getFullYear()}</p>
            </div>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    🖨️ Drucken / Als PDF speichern
                </button>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    Tipp: Im Druck-Dialog "Als PDF speichern" auswählen
                </p>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Kurz warten, dann Druck-Dialog öffnen
    setTimeout(() => {
        printWindow.print();
    }, 500);

    showToast('PDF Export vorbereitet - Druckdialog öffnet sich', 'success');
}

function exportExcel() {
    if (messenData.length === 0) {
        showToast('Keine Daten für Excel Export', 'warning');
        return;
    }
    
    // CSV Format erstellen
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    const headers = [
        'Messename',
        'Standort',
        'Land',
        'Datum von',
        'Datum bis',
        'Branche',
        'Status',
        'Verantwortlich',
        'Teilnahme als',
        'Rechnung bezahlt',
        'Rechnung fällig',
        'Währung',
        'Standnummer',
        'Standgröße (qm)',
        'Standkosten',
        'Stromkosten',
        'Wasserkosten',
        'Marketingkosten',
        'Mobiliarkosten',
        'Personalkosten',
        'Anreisekosten',
        'Unterkunftkosten',
        'Sonstige Kosten',
        'Gesamtkosten (EUR)',
        'Archiviert'
    ];
    
    csvContent += headers.join(';') + "\n";
    
    // Daten
    messenData.forEach(messe => {
        const total = calculateTotalCosts(messe);
        const totalEUR = convertToEUR(total, messe.waehrung);
        const isArchived = isMesseArchived(messe);
        
        const row = [
            `"${messe.messe_name || ''}"`,
            `"${messe.standort || ''}"`,
            `"${messe.land || ''}"`,
            formatDate(messe.datum_von),
            formatDate(messe.datum_bis),
            `"${messe.branche || ''}"`,
            `"${messe.status || ''}"`,
            `"${messe.verantwortlich || ''}"`,
            `"${messe.teilnahme_art || ''}"`,
            `"${messe.rechnung_bezahlt || ''}"`,
            formatDate(messe.rechnung_faellig),
            `"${messe.waehrung || ''}"`,
            `"${messe.stand_nummer || ''}"`,
            messe.stand_groesse || '',
            messe.stand_kosten || '0',
            messe.strom_kosten || '0',
            messe.wasser_kosten || '0',
            messe.marketing_kosten || '0',
            messe.mobiliar_kosten || '0',
            messe.personal_kosten || '0',
            messe.anreise_kosten || '0',
            messe.unterkunft_kosten || '0',
            messe.sonstige_kosten || '0',
            totalEUR.toFixed(2),
            isArchived ? 'Ja' : 'Nein'
        ];
        
        csvContent += row.join(';') + "\n";
    });
    
    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `haelok-messen-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Excel Export mit ${messenData.length} Messen gestartet`, 'success');
}

// ========== TOAST ==========
function showToast(message, type = 'info') {
    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-600',
        info: 'bg-blue-600'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${colors[type]} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3`;
    toast.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="font-medium">${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}