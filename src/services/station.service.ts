import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LPGStation } from '../types';
import { environment } from '../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/stations';

  private readonly _stations = signal<LPGStation[]>([]);

  // Public readonly signal for consumers
  readonly stations = this._stations.asReadonly();

  // Loading state
  readonly isLoading = signal<boolean>(true);

  // Public state signals
  readonly searchQuery = signal<string>('');
  readonly selectedBrand = signal<string | null>(null);

  constructor() {
    this.loadStations();
  }

  private async loadStations() {
    try {
      this.isLoading.set(true);
      const data = await firstValueFrom(this.http.get<LPGStation[]>(this.apiUrl));
      this._stations.set(data || []);
    } catch (error) {
      console.error('Failed to load stations from backend API:', error);
    } finally {
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
    try {
      const created = await firstValueFrom(this.http.post<LPGStation>(this.apiUrl, station));
      this._stations.update(stations => [...stations, created]);
    } catch (e) {
      console.error('Error adding station:', e);
      throw e;
    }
  }

  async updateStation(originalName: string, updatedStation: LPGStation) {
    try {
      if (originalName !== updatedStation.name) {
        // Name changed: delete old, create new
        await firstValueFrom(this.http.delete(`${this.apiUrl}/${encodeURIComponent(originalName)}`));
        const created = await firstValueFrom(this.http.post<LPGStation>(this.apiUrl, updatedStation));

        // Update local state: remove old, add new
        this._stations.update(stations => [
          ...stations.filter(s => s.name !== originalName),
          created
        ]);
      } else {
        // Just update
        const updated = await firstValueFrom(this.http.put<LPGStation>(`${this.apiUrl}/${encodeURIComponent(originalName)}`, updatedStation));

        // Update local state: find and replace
        this._stations.update(stations =>
          stations.map(s => s.name === originalName ? updated : s)
        );
      }
    } catch (e) {
      console.error('Error updating station:', e);
      throw e;
    }
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