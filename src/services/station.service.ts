import { Injectable, signal, computed } from '@angular/core';
import { LPGStation } from '../types';
import { STATIONS_DATA } from '../data/stations.data';

@Injectable({
  providedIn: 'root'
})
export class StationService {
  // Make internal signal writable, initialize with static data
  private readonly _stations = signal<LPGStation[]>(STATIONS_DATA);
  
  // Public readonly signal for consumers
  readonly stations = this._stations.asReadonly();
  
  // Public state signals
  readonly searchQuery = signal<string>('');
  readonly selectedBrand = signal<string | null>(null);

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

  addStation(station: LPGStation) {
    this._stations.update(current => [...current, station]);
  }

  updateStation(originalName: string, updatedStation: LPGStation) {
    this._stations.update(current => 
      current.map(s => s.name === originalName ? updatedStation : s)
    );
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
}