// ========== LOKALER DATENSPEICHER ==========
class LocalDataSdk {
    constructor() {
        this.storageKey = 'haelok-messeplaner-data-v1';
        this.currentData = this.loadFromStorage();
    }
    
    // Initialisiere die App
    async init(dataHandler) {
        this.dataHandler = dataHandler;
        // Kurze Verzögerung, um sicherzustellen, dass alles geladen ist
        setTimeout(() => this.notifyDataChanged(), 100);
        return { isOk: true };
    }
    
    // Daten aus LocalStorage laden
    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            // Bei Fehler leeres Array zurückgeben
            return [];
        }
    }
    
    // Daten in LocalStorage speichern
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentData));
            return true;
        } catch (error) {
            console.error('Fehler beim Speichern der Daten:', error);
            // Falls LocalStorage voll ist, versuche alte Daten zu löschen
            if (error.name === 'QuotaExceededError') {
                alert('Speicher ist voll. Bitte exportieren Sie Daten und löschen Sie alte Einträge.');
            }
            return false;
        }
    }
    
    // Neue Messe erstellen
    async create(messe) {
        try {
            // Neue eindeutige ID generieren
            const newId = 'messe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Standardfelder für neue Messen setzen
            const newMesse = {
                ...messe,
                __backendId: newId,
                type: 'messe',
                created: new Date().toISOString(),
                // Standardwerte für Task-Felder setzen
                task_eigene_erinnerung_erledigt: 'false',
                task_checkliste_erledigt: 'false',
                task_crm_erledigt: 'false',
                task_linkedin_erledigt: 'false',
                task_followup_erledigt: 'false'
            };
            
            this.currentData.push(newMesse);
            
            if (this.saveToStorage()) {
                this.notifyDataChanged();
                return { 
                    isOk: true, 
                    data: newMesse 
                };
            } else {
                return { 
                    isOk: false, 
                    error: { message: 'Fehler beim Speichern in LocalStorage' } 
                };
            }
        } catch (error) {
            console.error('Fehler beim Erstellen:', error);
            return { 
                isOk: false, 
                error: { message: error.message || 'Unbekannter Fehler' } 
            };
        }
    }
    
    // Messe aktualisieren
    async update(updatedMesse) {
        try {
            const index = this.currentData.findIndex(m => m.__backendId === updatedMesse.__backendId);
            if (index === -1) {
                return { 
                    isOk: false, 
                    error: { message: 'Messe nicht gefunden' } 
                };
            }
            
            // Bestehende Daten mit Updates mergen
            this.currentData[index] = {
                ...this.currentData[index],
                ...updatedMesse,
                updated: new Date().toISOString()
            };
            
            if (this.saveToStorage()) {
                this.notifyDataChanged();
                return { 
                    isOk: true, 
                    data: this.currentData[index] 
                };
            } else {
                return { 
                    isOk: false, 
                    error: { message: 'Fehler beim Speichern in LocalStorage' } 
                };
            }
        } catch (error) {
            console.error('Fehler beim Aktualisieren:', error);
            return { 
                isOk: false, 
                error: { message: error.message || 'Unbekannter Fehler' } 
            };
        }
    }
    
    // Messe löschen
    async delete(messe) {
        try {
            const index = this.currentData.findIndex(m => m.__backendId === messe.__backendId);
            if (index === -1) {
                return { 
                    isOk: false, 
                    error: { message: 'Messe nicht gefunden' } 
                };
            }
            
            this.currentData.splice(index, 1);
            
            if (this.saveToStorage()) {
                this.notifyDataChanged();
                return { isOk: true };
            } else {
                return { 
                    isOk: false, 
                    error: { message: 'Fehler beim Speichern in LocalStorage' } 
                };
            }
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
            return { 
                isOk: false, 
                error: { message: error.message || 'Unbekannter Fehler' } 
            };
        }
    }
    
    // Alle Daten zurückgeben
    async getAll() {
        return { 
            isOk: true, 
            data: this.currentData 
        };
    }
    
    // Datenänderungen an den Handler melden
    notifyDataChanged() {
        if (this.dataHandler && this.dataHandler.onDataChanged) {
            this.dataHandler.onDataChanged(this.currentData);
        }
    }
    
    // Daten zurücksetzen (für Tests)
    async reset() {
        this.currentData = [];
        this.saveToStorage();
        this.notifyDataChanged();
        return { isOk: true };
    }
    
    // Daten importieren
    async importData(dataArray) {
        try {
            // Bestehende IDs speichern, um Duplikate zu vermeiden
            const existingIds = new Set(this.currentData.map(m => m.__backendId));
            
            // Neue Daten filtern und hinzufügen
            const newData = dataArray.filter(item => {
                // Prüfen, ob es sich um eine Messe handelt
                if (!item || typeof item !== 'object') return false;
                if (!item.__backendId) return false;
                return !existingIds.has(item.__backendId);
            });
            
            this.currentData.push(...newData);
            
            if (this.saveToStorage()) {
                this.notifyDataChanged();
                return { 
                    isOk: true, 
                    count: newData.length 
                };
            } else {
                return { 
                    isOk: false, 
                    error: { message: 'Fehler beim Speichern importierter Daten' } 
                };
            }
        } catch (error) {
            console.error('Fehler beim Importieren:', error);
            return { 
                isOk: false, 
                error: { message: error.message || 'Unbekannter Fehler' } 
            };
        }
    }
}

// Globale Instanz erstellen
window.dataSdk = new LocalDataSdk();