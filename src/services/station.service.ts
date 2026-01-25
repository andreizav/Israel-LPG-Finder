import { Injectable, signal, computed } from '@angular/core';
// import { Firestore, collectionData } from '@angular/fire/firestore'; // Removed unused
import { collection, doc, setDoc, deleteDoc, query, getFirestore, getDocs, disableNetwork, enableNetwork } from 'firebase/firestore';
import { LPGStation } from '../types';
import { STATIONS_DATA } from '../data/stations.data';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StationService {
  private firestore = getFirestore(); // Use direct SDK instance
  private stationsCollection = collection(this.firestore, 'stations');

  // Make internal signal writable, initialize with empty array
  // We will sync this with Firestore
  private readonly _stations = signal<LPGStation[]>([]);

  // Public readonly signal for consumers
  readonly stations = this._stations.asReadonly();

  // Loading state
  readonly isLoading = signal<boolean>(true);

  // Public state signals
  readonly searchQuery = signal<string>('');
  readonly selectedBrand = signal<string | null>(null);

  constructor() {
    this.connectToFirestore();
  }

  private async connectToFirestore() {
    const q = query(this.stationsCollection);

    try {
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data() as LPGStation);
      this._stations.set(data);
      this.isLoading.set(false);

      // Stop the persistent connection/heartbeat
      setTimeout(async () => {
        try {
          await disableNetwork(this.firestore);
        } catch (e) {
          console.warn('Network disable failed:', e);
        }
      }, 500);
    } catch (error) {
      console.error('Error fetching stations:', error);
      this.isLoading.set(false);
    }
  }

  // Computed: Get unique brands for the filter dropdown
  readonly availableBrands = computed(() => {
    const allBrands = this.stations().map(s => s.brand);
    // Remove duplicates and sort
    return [...new Set(allBrands)].sort();
  });

  // Computed: Filter and Sort stations
  readonly filteredStations = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const brand = this.selectedBrand();
    const all = this.stations();

    let filtered = all;

    // Filter by Brand
    if (brand) {
      filtered = filtered.filter(s => s.brand === brand);
    }

    // Filter by Search (City HE, City EN, Name)
    if (query) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.city_he.includes(query) ||
        s.city_en.toLowerCase().includes(query)
      );
    }

    // Sort by City (Hebrew), then Name
    return filtered.sort((a, b) => {
      const cityCompare = a.city_he.localeCompare(b.city_he, 'he');
      if (cityCompare !== 0) return cityCompare;
      return a.name.localeCompare(b.name, 'he');
    });
  });

  getStationByName(name: string): LPGStation | undefined {
    return this.stations().find(s => s.name === name);
  }

  async addStation(station: LPGStation) {
    await enableNetwork(this.firestore);
    const docId = this.generateDocId(station.name);
    try {
      await setDoc(doc(this.firestore, 'stations', docId), station);
      // Update local state
      this._stations.update(stations => [...stations, station]);
    } catch (e) {
      console.error('Error adding station:', e);
      throw e;
    }
  }

  async updateStation(originalName: string, updatedStation: LPGStation) {
    await enableNetwork(this.firestore);
    const originalDocId = this.generateDocId(originalName);
    const newDocId = this.generateDocId(updatedStation.name);

    try {
      if (originalDocId !== newDocId) {
        // Name changed: delete old, create new
        await deleteDoc(doc(this.firestore, 'stations', originalDocId));
        await setDoc(doc(this.firestore, 'stations', newDocId), updatedStation);

        // Update local state: remove old, add new
        this._stations.update(stations => [
          ...stations.filter(s => s.name !== originalName),
          updatedStation
        ]);
      } else {
        // Just update
        await setDoc(doc(this.firestore, 'stations', originalDocId), updatedStation, { merge: true });

        // Update local state: find and replace
        this._stations.update(stations =>
          stations.map(s => s.name === originalName ? { ...s, ...updatedStation } : s)
        );
      }
    } catch (e) {
      console.error('Error updating station:', e);
      throw e;
    }
  }

  private generateDocId(name: string): string {
    return name.replace(/\s+/g, '_').toLowerCase();
  }

  // Generate Waze link
  getWazeLink(station: LPGStation): string {
    const query = `${station.name} ${station.city_he}`;
    return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
  }

  async processComment(station: LPGStation, comment: string): Promise<string> {
    await enableNetwork(this.firestore);

    // 1. Always save the comment to the current station
    const docId = this.generateDocId(station.name);
    try {
      await setDoc(doc(this.firestore, 'stations', docId), { comment }, { merge: true });

      // Update local state for the comment
      this._stations.update(stations =>
        stations.map(s => s.name === station.name ? { ...s, comment } : s)
      );

    } catch (e) {
      console.error('Error saving comment:', e);
      return 'שגיאה בשמירת התגובה';
    }

    // 2. Try parsing as JSON for advanced operations
    let jsonData: any;
    try {
      jsonData = JSON.parse(comment);
    } catch (e) {
      // Not JSON, just a regular comment
      return 'התגובה נשמרה בהצלחה';
    }

    // 3. Process JSON Logic
    let updatesCount = 0;
    let createsCount = 0;

    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    const currentStations = this.stations();

    for (const item of dataArray) {
      if (typeof item !== 'object' || item === null) continue;

      // 3. Match Logic:
      // - If Name matches -> Update (handles moving station)
      // - If Name different BUT Location matches (approx 11m) -> Update (handles renaming station)
      // - If Name different AND Location different -> Add New Station

      // A. Try Name Match
      let match = currentStations.find(s => s.name === item.name);

      // B. Try Location Match if no Name match
      if (!match && item.lat && item.lng) {
        // Threshold: 0.0001 degrees is approx 11 meters.
        // This allows for minor coordinate precision differences but treats "close enough" as the same station.
        const epsilon = 0.0001;
        match = currentStations.find(s =>
          Math.abs(s.lat - item.lat) < epsilon &&
          Math.abs(s.lng - item.lng) < epsilon
        );
      }

      if (match) {
        // FOUND: Update existing station
        // Merging item data into match.
        // If 'name' in item is different from match.name, StationService.updateStation handles the rename (delete old doc, create new).
        this.updateStation(match.name, { ...match, ...item });
        updatesCount++;
      } else {
        // Create new (ensure required fields exist)
        if (item.name && item.lat && item.lng) {
          // Defaults
          const newStation: LPGStation = {
            city_he: '',
            city_en: '',
            address: '',
            brand: 'General',
            ...item
          };
          this.addStation(newStation);
          createsCount++;
        }
      }
    }

    return `התגובה נשמרה. ${updatesCount} תחנות עודכנו, ${createsCount} תחנות נוספו.`;
  }

  // Price styling helpers
  getPriceColorClass(price?: number): string {
    if (!price) return 'text-gray-500';
    if (price < 3.50) return 'text-green-600';
    if (price > 4.00) return 'text-red-600';
    return 'text-gray-900';
  }

  // Seed data to Firestore (Run once)
  async seedStations() {
    await enableNetwork(this.firestore);
    console.log('Seeding stations...');
    const staticData = STATIONS_DATA;
    let addedCount = 0;
    let skippedCount = 0;

    for (const station of staticData) {
      // Create a doc ID based on the name to prevent duplicates easily
      // Basic sanitization similar to slug
      const docId = station.name.replace(/\s+/g, '_').toLowerCase();
      const stationDoc = doc(this.firestore, 'stations', docId);

      // We use setDoc with merge: true (or just setDoc if we want to overwrite)
      // Checks if exists is harder without a get(), but setDoc is idempotent
      try {
        await setDoc(stationDoc, station);
        addedCount++;
      } catch (e) {
        console.error('Error adding station:', station.name, e);
      }
    }
    console.log(`Seeding complete. Added/Updated: ${addedCount}`);
    alert(`Seeding complete. Processed ${addedCount} stations.`);
  }
}