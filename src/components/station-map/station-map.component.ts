import { Component, ChangeDetectionStrategy, ElementRef, ViewChild, AfterViewInit, OnDestroy, effect, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import L from 'leaflet';
import { LPGStation } from '../../types';
import { StationService } from '../../services/station.service';

@Component({
  selector: 'app-station-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full h-full">
      <div #mapContainer class="w-full h-full z-0"></div>
      
      <!-- Locate Me Button -->
      <button 
        (click)="locateUser()"
        class="absolute bottom-6 left-4 z-[400] bg-white p-3 rounded-full shadow-lg text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
        title="המיקום שלי"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class StationMapComponent implements AfterViewInit, OnDestroy {
  stations = input.required<LPGStation[]>();
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  stationService = inject(StationService);
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private userMarker: L.Marker | undefined;

  constructor() {
    effect(() => {
      const currentStations = this.stations();
      // Ensure map exists and is not destroyed
      if (this.map) {
        this.updateMarkers(currentStations);
      }
    });
  }

  ngAfterViewInit() {
    if (this.mapContainer?.nativeElement) {
      this.initMap();
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  locateUser() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.setUserLocation(position.coords.latitude, position.coords.longitude);
          this.map?.setView([position.coords.latitude, position.coords.longitude], 12);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          alert('לא ניתן לאתר את מיקומך. אנא אשר גישה למיקום או לחץ על המפה לקביעת מיקום.');
        }
      );
    } else {
      alert('הדפדפן שלך אינו תומך בשירותי מיקום.');
    }
  }

  private initMap() {
    // Center of Israel roughly
    this.map = L.map(this.mapContainer.nativeElement).setView([31.5, 34.8], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ''
    }).addTo(this.map);

    this.updateMarkers(this.stations());

    // Add click handler for user location
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.setUserLocation(e.latlng.lat, e.latlng.lng);
    });

    // Try to get initial location quietly
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => this.setUserLocation(position.coords.latitude, position.coords.longitude),
        () => { } // Ignore errors on auto-init
      );
    }
  }

  private setUserLocation(lat: number, lng: number) {
    if (!this.map) return;

    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = L.marker([lat, lng], {
        icon: this.createUserIcon(),
        zIndexOffset: 1000 // Ensure it's on top
      }).addTo(this.map);

      this.userMarker.bindPopup(`
            <div class="font-heebo text-center p-1">
              <div class="font-bold text-blue-700">המיקום שלך</div>
              <div class="text-[10px] text-gray-500">לחץ על המפה לשינוי</div>
            </div>
          `);
    }
  }

  private createUserIcon(): L.DivIcon {
    // pulsing blue dot
    const html = `
        <div class="relative w-6 h-6 flex items-center justify-center">
            <span class="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-50 animate-ping"></span>
            <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-md"></span>
        </div>
      `;

    return L.divIcon({
      html: html,
      className: 'bg-transparent border-none', // Override default leaflet divIcon styles
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  }

  private updateMarkers(stations: LPGStation[]) {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(m => m.remove());
    this.markers = [];

    const bounds = L.latLngBounds([]);

    stations.forEach(station => {
      if (!station.lat || !station.lng) return;

      const marker = L.marker([station.lat, station.lng], {
        icon: this.createCustomIcon(station)
      }).addTo(this.map!);

      // Bind Popup - Compact Info Window
      const popupContent = `
        <div class="text-right font-heebo min-w-[200px]" dir="rtl">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h3 class="font-bold text-base leading-tight text-gray-900">${station.name}</h3>
              <p class="text-xs text-gray-500">${station.city_he}</p>
            </div>
            <div class="bg-gray-100 px-2 py-1 rounded text-[10px] text-gray-600 font-medium whitespace-nowrap">
              ${station.brand}
            </div>
          </div>
          
          <div class="flex items-baseline gap-1 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
             <span class="text-xs text-gray-500 font-medium">מחיר לליטר:</span>
             <span class="font-black text-xl ${this.getPriceColorClass(station.price_ils)} flex-1 text-left">
               ${station.price_ils ? station.price_ils + ' ₪' : 'N/A'}
             </span>
          </div>

          <a href="${this.stationService.getWazeLink(station)}" target="_blank" 
             class="block w-full bg-[#33ccff] hover:bg-[#2cb5e3] text-white text-center text-sm font-bold py-2.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 group active:scale-95 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="group-hover:animate-pulse">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 6V11H6V13H11V18H13V13H18V11H13V6H11Z" fill="white" fill-opacity="0" />
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            נווט לתחנה
          </a>
        </div>
      `;

      marker.bindPopup(popupContent, { minWidth: 220, closeButton: true, autoPan: true });
      this.markers.push(marker);
      bounds.extend([station.lat, station.lng]);
    });

    if (stations.length > 0 && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  private createCustomIcon(station: LPGStation): L.DivIcon {
    let bgColorClass = 'bg-blue-600';
    let borderColorClass = 'border-t-blue-600';

    if (station.price_ils) {
      if (station.price_ils < 3.50) {
        bgColorClass = 'bg-green-600';
        borderColorClass = 'border-t-green-600';
      } else if (station.price_ils > 4.00) {
        bgColorClass = 'bg-red-600';
        borderColorClass = 'border-t-red-600';
      }
    } else {
      bgColorClass = 'bg-gray-500';
      borderColorClass = 'border-t-gray-500';
    }

    const priceStr = station.price_ils ? station.price_ils.toFixed(2) : '?';

    // A rectangular price tag with an arrow
    const html = `
      <div class="flex flex-col items-center justify-center transform hover:scale-110 transition-transform duration-200 group">
        <div class="${bgColorClass} text-white font-bold text-xs px-2 py-1 rounded-md shadow-lg border-[1.5px] border-white min-w-[42px] text-center whitespace-nowrap">
          ${priceStr} 
        </div>
        <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${borderColorClass} -mt-[1px]"></div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'custom-div-icon bg-transparent border-none', // Important: removes default leaflet square background
      iconSize: [42, 40],
      iconAnchor: [21, 35], // Point of arrow is anchor
      popupAnchor: [0, -35]
    });
  }

  private getPriceColorClass(price?: number): string {
    if (!price) return 'text-gray-500';
    if (price < 3.50) return 'text-green-600';
    if (price > 4.00) return 'text-red-600';
    return 'text-gray-900';
  }
}