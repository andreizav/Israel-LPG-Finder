import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LPGStation } from '../types';
import { STATIONS_DATA } from '../data/stations.data';
import { catchError, map, of, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StationService {
  private http = inject(HttpClient);

  // Replace this with your published Google Sheet CSV URL
  private readonly GOOGLE_SHEET_CSV_URL = 'YOUR_GOOGLE_SHEET_CSV_URL_HERE';

  // Make internal signal writable, initialize with static data (Fallback)
  private readonly _stations = signal<LPGStation[]>(STATIONS_DATA);

  // Public readonly signal for consumers
  readonly stations = this._stations.asReadonly();

  // Loading state
  readonly isLoading = signal<boolean>(false);

  // Public state signals
  readonly searchQuery = signal<string>('');
  readonly selectedBrand = signal<string | null>(null);

  constructor() {
    this.loadStations();
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

  private async loadStations() {
    if (this.GOOGLE_SHEET_CSV_URL === 'YOUR_GOOGLE_SHEET_CSV_URL_HERE') {
      console.warn('Google Sheet URL not configured. Using static data.');
      return;
    }

    this.isLoading.set(true);

    try {
      const csvData = await firstValueFrom(
        this.http.get(this.GOOGLE_SHEET_CSV_URL, { responseType: 'text' }).pipe(
          catchError(err => {
            console.error('Failed to fetch/parse CSV', err);
            // Return null to trigger fallback (effectively doing nothing as _stations is already init)
            return of(null);
          })
        )
      );

      if (csvData) {
        const parsedStations = this.parseCSV(csvData);
        if (parsedStations.length > 0) {
          this._stations.set(parsedStations);
        }
      }
    } catch (e) {
      console.error('Error loading stations', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  private parseCSV(csvText: string): LPGStation[] {
    const lines = csvText.split('\n');
    if (lines.length < 2) return []; // Header + 1 row minimum

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const stations: LPGStation[] = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      if (!currentLine) continue;

      // Simple CSV split (handling simple commas only, advanced regex would be better for complex CSVs)
      // For Google Sheets defaults, this usually works unless fields have commas. 
      // A robust regex split is recommended for production.
      const values = currentLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      // Fallback for simple split if regex misses (simple variant)
      const simpleValues = currentLine.split(',');

      // Using simple split for now as it's lightweight and usually fine for this data model 
      // (assuming no commas in names/addresses, otherwise need standard CSV parser)
      const row = simpleValues.map(v => v.trim().replace(/^"|"$/g, ''));

      if (row.length < headers.length) continue; // Skip malformed rows

      const station: any = {};

      headers.forEach((header, index) => {
        let value: any = row[index];

        // Type conversion
        if (header === 'lat' || header === 'lng' || header === 'price_ils') {
          value = parseFloat(value);
          if (isNaN(value)) value = undefined;
        }
        if (header === 'on_highway') {
          value = value === 'true' || value === 'TRUE';
        }

        station[header] = value;
      });

      // Basic validation
      if (station.name && station.lat && station.lng) {
        stations.push(station as LPGStation);
      }
    }

    return stations;
  }

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