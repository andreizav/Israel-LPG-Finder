import { Injectable, signal, computed } from '@angular/core';
// import { Firestore, collectionData } from '@angular/fire/firestore'; // Removed unused
import { collection, doc, setDoc, deleteDoc, query, getFirestore, onSnapshot } from 'firebase/firestore';
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

  private connectToFirestore() {
    const q = query(this.stationsCollection);

    // Using onSnapshot for direct SDK usage without RxJS wrapper issues
    onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as LPGStation);
      this._stations.set(data);
      this.isLoading.set(false);
    }, (error) => {
      console.error('Error fetching stations:', error);
      this.isLoading.set(false);
    });
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
    const docId = this.generateDocId(station.name);
    try {
      await setDoc(doc(this.firestore, 'stations', docId), station);
    } catch (e) {
      console.error('Error adding station:', e);
      throw e;
    }
  }

  async updateStation(originalName: string, updatedStation: LPGStation) {
    const originalDocId = this.generateDocId(originalName);
    const newDocId = this.generateDocId(updatedStation.name);

    try {
      if (originalDocId !== newDocId) {
        // Name changed: delete old, create new
        await deleteDoc(doc(this.firestore, 'stations', originalDocId));
        await setDoc(doc(this.firestore, 'stations', newDocId), updatedStation);
      } else {
        // Just update
        await setDoc(doc(this.firestore, 'stations', originalDocId), updatedStation, { merge: true });
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

  // Price styling helpers
  getPriceColorClass(price?: number): string {
    if (!price) return 'text-gray-500';
    if (price < 3.50) return 'text-green-600';
    if (price > 4.00) return 'text-red-600';
    return 'text-gray-900';
  }

  // Seed data to Firestore (Run once)
  async seedStations() {
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