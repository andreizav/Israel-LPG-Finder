import { Component, ChangeDetectionStrategy, inject, signal, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { StationService } from '../../services/station.service';
import { LPGStation } from '../../types';
import L from 'leaflet';

@Component({
  selector: 'app-station-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 pb-safe">
      <!-- Navbar with Safe Area -->
      <nav class="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-auto pt-safe flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3 h-14 w-full">
          <button (click)="goBack()" class="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <h1 class="font-bold text-lg text-gray-800">{{ isEditMode() ? 'עריכת תחנה' : 'הוספת תחנה' }}</h1>
        </div>
        <button 
          (click)="save()" 
          [disabled]="form.invalid"
          class="text-blue-600 font-bold text-sm px-3 py-1 rounded-full hover:bg-blue-50 disabled:opacity-50 disabled:hover:bg-transparent whitespace-nowrap"
        >
          שמירה
        </button>
      </nav>

      <div class="p-4 max-w-2xl mx-auto">
        <form [formGroup]="form" class="space-y-6">
          
          <!-- Basic Info Section -->
          <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <h2 class="font-bold text-gray-700 text-sm border-b pb-2 mb-2">פרטים כלליים</h2>
            
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">שם התחנה <span class="text-red-500">*</span></label>
              <input formControlName="name" type="text" class="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">עיר (עברית) <span class="text-red-500">*</span></label>
                <input formControlName="city_he" type="text" class="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">City (English)</label>
                <input formControlName="city_en" type="text" class="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-left" dir="ltr" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">כתובת <span class="text-red-500">*</span></label>
              <input formControlName="address" type="text" class="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">מותג <span class="text-red-500">*</span></label>
              <input formControlName="brand" list="brands" type="text" class="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
              <datalist id="brands">
                @for (brand of stationService.availableBrands(); track brand) {
                  <option [value]="brand"></option>
                }
              </datalist>
            </div>
          </div>

          <!-- Price & Status -->
          <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
             <h2 class="font-bold text-gray-700 text-sm border-b pb-2 mb-2">מחיר וסטטוס</h2>
             
             <div class="grid grid-cols-2 gap-4">
               <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">מחיר (₪)</label>
                  <input formControlName="price_ils" type="number" step="0.01" class="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
               <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">סטטוס (אופציונלי)</label>
                  <input formControlName="status" placeholder="לדוגמה: תקלה זמנית" type="text" class="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
             </div>
          </div>

          <!-- Location Picker -->
          <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <h2 class="font-bold text-gray-700 text-sm border-b pb-2 mb-2">מיקום במפה <span class="text-red-500">*</span></h2>
            <p class="text-xs text-gray-500">לחץ על המפה לסימון מיקום התחנה המדויק.</p>
            
            <div class="h-64 rounded-lg overflow-hidden border border-gray-300 relative z-0">
               <div #mapContainer class="w-full h-full"></div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-xs">
              <div class="bg-gray-50 p-2 rounded border">
                <span class="text-gray-500 block">קו רוחב (Lat)</span>
                <span class="font-mono font-bold">{{ form.get('lat')?.value || '-' }}</span>
              </div>
              <div class="bg-gray-50 p-2 rounded border">
                <span class="text-gray-500 block">קו אורך (Lng)</span>
                <span class="font-mono font-bold">{{ form.get('lng')?.value || '-' }}</span>
              </div>
            </div>
            
            @if (form.hasError('locationRequired') && form.touched) {
               <p class="text-red-500 text-xs font-bold">חובה לבחור מיקום במפה</p>
            }
          </div>

        </form>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class StationFormComponent implements OnInit, AfterViewInit, OnDestroy {
  private fb: FormBuilder = inject(FormBuilder);
  stationService = inject(StationService);
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);

  @ViewChild('mapContainer') mapContainer!: ElementRef;

  form: FormGroup;
  isEditMode = signal(false);
  originalName = '';

  private map: L.Map | undefined;
  private marker: L.Marker | undefined;

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      city_he: ['', Validators.required],
      city_en: [''],
      address: ['', Validators.required],
      brand: ['', Validators.required],
      price_ils: [null],
      status: [''],
      lat: [null, Validators.required],
      lng: [null, Validators.required]
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const name = params.get('name');
      if (name) {
        this.isEditMode.set(true);
        this.originalName = name;
        const station = this.stationService.getStationByName(name);
        if (station) {
          this.form.patchValue(station);
        } else {
          // Station not found
          this.router.navigate(['/']);
        }
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

  private initMap() {
    const lat = this.form.get('lat')?.value;
    const lng = this.form.get('lng')?.value;

    // Default center (Israel) or Station location
    const center: L.LatLngExpression = lat && lng ? [lat, lng] : [31.5, 34.8];
    const zoom = lat && lng ? 14 : 8;

    this.map = L.map(this.mapContainer.nativeElement).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ''
    }).addTo(this.map);

    // If editing, place initial marker
    if (lat && lng) {
      this.placeMarker(lat, lng);
    }

    // Map Click Event
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.updateLocation(e.latlng.lat, e.latlng.lng);
    });
  }

  private updateLocation(lat: number, lng: number) {
    this.placeMarker(lat, lng);
    this.form.patchValue({ lat, lng });
    this.form.markAsDirty();
  }

  private placeMarker(lat: number, lng: number) {
    if (!this.map) return;

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      // Create a draggable custom icon marker
      // Using custom icon to avoid default asset issues
      const icon = L.divIcon({
        html: `
          <div class="relative w-8 h-8 -ml-4 -mt-8">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-blue-600 drop-shadow-md">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/20 rounded-full blur-[2px]"></div>
          </div>
        `,
        className: 'border-none bg-transparent',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      this.marker = L.marker([lat, lng], {
        draggable: true,
        icon: icon
      }).addTo(this.map);

      // Handle drag end
      this.marker.on('dragend', (event) => {
        const marker = event.target;
        const position = marker.getLatLng();
        this.form.patchValue({ lat: position.lat, lng: position.lng });
        this.form.markAsDirty();
      });
    }
  }

  save() {
    if (this.form.invalid) return;

    const formVal = this.form.value;

    const station: LPGStation = {
      name: formVal.name,
      city_he: formVal.city_he,
      city_en: formVal.city_en || formVal.city_he, // Fallback
      address: formVal.address,
      brand: formVal.brand,
      price_ils: formVal.price_ils,
      status: formVal.status,
      lat: formVal.lat,
      lng: formVal.lng,
      last_updated: new Date().toLocaleDateString('en-GB').replace(/\//g, '.') // Simple DD.MM.YYYY
    };

    if (this.isEditMode()) {
      this.stationService.updateStation(this.originalName, station);
    } else {
      this.stationService.addStation(station);
    }

    this.goBack();
  }

  goBack() {
    if (this.isEditMode()) {
      this.router.navigate(['/station', this.originalName]); // Go back to detail if editing
    } else {
      this.router.navigate(['/']); // Go back to list if adding
    }
  }
}