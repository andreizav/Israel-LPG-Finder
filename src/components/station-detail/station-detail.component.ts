import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { StationService } from '../../services/station.service';
import { LPGStation } from '../../types';

@Component({
  selector: 'app-station-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white">
      <!-- Navbar -->
      <nav class="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a routerLink="/" class="p-2 -mr-2 text-gray-600 hover:bg-gray-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
          <h1 class="font-bold text-lg truncate text-left">פרטי תחנה</h1>
        </div>
        
        @if (station(); as s) {
          <a [routerLink]="['/edit', s.name]" class="text-blue-600 p-2 text-sm font-bold hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            עריכה
          </a>
        }
      </nav>

      @if (station(); as s) {
        <div class="p-6">
          <!-- Header Card -->
          <div class="text-center mb-8">
            <div class="w-20 h-20 bg-blue-50 text-blue-600 rounded-full mx-auto flex items-center justify-center text-xl font-bold mb-4 shadow-sm">
              {{ getInitials(s.brand) }}
            </div>
            <h2 class="text-2xl font-extrabold text-gray-900 mb-1">{{ s.name }}</h2>
            <p class="text-gray-500">{{ s.city_he }} | {{ s.city_en }}</p>
            <div class="mt-2 inline-block px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
              {{ s.brand }}
            </div>
          </div>

          <!-- Price Card -->
          <div class="bg-gray-50 rounded-2xl p-6 mb-6 text-center border border-gray-100">
            <p class="text-gray-500 text-sm mb-1">מחיר לליטר גפ״מ</p>
            @if (s.price_ils) {
              <div [class]="stationService.getPriceColorClass(s.price_ils)" class="text-5xl font-black tracking-tight">
                {{ s.price_ils }} <span class="text-2xl font-bold">₪</span>
              </div>
              <p class="text-xs text-gray-400 mt-2">עודכן לאחרונה: {{ s.last_updated }}</p>
            } @else {
              <div class="text-3xl font-bold text-gray-300">N/A</div>
              <p class="text-xs text-gray-400 mt-2">מחיר לא זמין</p>
            }
          </div>

          <!-- Status / Warnings -->
          @if (s.status) {
            <div class="bg-red-50 border-r-4 border-red-500 p-4 rounded-lg mb-4 flex gap-3 items-start">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 class="font-bold text-red-700 text-sm">סטטוס תחנה</h3>
                <p class="text-red-600 text-sm">{{ s.status }}</p>
              </div>
            </div>
          }

          <!-- Static Warning -->
          <div class="bg-amber-50 border-r-4 border-amber-400 p-4 rounded-lg mb-6 flex gap-3 items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 class="font-bold text-amber-800 text-sm">מידע חשוב</h3>
              <p class="text-amber-700 text-sm leading-snug">
                חל איסור מוחלט על מילוי מכלי גז ביתיים בתחנה זו. התחנה מיועדת לתדלוק רכב בלבד.
              </p>
            </div>
          </div>

          <!-- Details List -->
          <div class="space-y-4 mb-8">
            <div class="flex items-start gap-3">
              <div class="mt-1 bg-blue-50 p-2 rounded-lg text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <label class="block text-xs text-gray-400 uppercase font-bold tracking-wider">כתובת</label>
                <p class="text-gray-800 font-medium">{{ s.address }}, {{ s.city_he }}</p>
              </div>
            </div>
          </div>

          <!-- Navigate Button -->
          <a [href]="stationService.getWazeLink(s)" target="_blank" class="w-full flex items-center justify-center gap-2 bg-[#33ccff] hover:bg-[#2cb5e3] text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 6V11H6V13H11V18H13V13H18V11H13V6H11Z" fill="white" fill-opacity="0" />
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
             </svg>
             נווט באמצעות Waze
          </a>

        </div>
      } @else {
        <div class="p-10 text-center text-gray-500">
          טוען נתונים או שהתחנה לא נמצאה...
        </div>
      }
    </div>
  `
})
export class StationDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  stationService = inject(StationService);
  station = signal<LPGStation | undefined>(undefined);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const name = params.get('name');
      if (name) {
        // Use a computed to react to service updates
        // However, for simplicity here, we'll re-fetch when params change.
        // Better pattern: use a computed in the component that depends on the service signal
        
        // Let's create an effect or just update the signal from the service
        // Since the service signal changes, we need this component to update
        this.updateStationData(name);
      }
    });
  }
  
  // Re-fetch when the component initializes or params change
  updateStationData(name: string) {
      // Because `stations` in service is a signal, we can just grab it.
      // But we want it to be reactive if the service updates while we are looking at the detail.
      // So let's use a computed.
      const found = this.stationService.getStationByName(name);
      this.station.set(found);
  }

  getInitials(brand: string): string {
    return brand ? brand.substring(0, 2).toUpperCase() : '??';
  }
}