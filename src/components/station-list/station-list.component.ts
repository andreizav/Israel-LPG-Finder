import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { StationService } from '../../services/station.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StationMapComponent } from '../station-map/station-map.component';

type ViewMode = 'list' | 'map';

@Component({
  selector: 'app-station-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, StationMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header with Safe Area Padding -->
    <header class="bg-blue-700 text-white p-4 pt-safe shadow-md sticky top-0 z-10 flex flex-col gap-3">
      <div class="flex justify-between items-center mt-2">
        <div>
          <h1 class="text-2xl font-bold">Israel LPG Finder</h1>
          <div class="text-xs text-blue-200 mt-1 font-medium">
            {{ stationService.filteredStations().length }} תחנות זמינות
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <!-- Import Button -->
          <!-- Import Button Removed -->

          <!-- View Toggle -->
          <div class="bg-blue-800 rounded-lg p-1 flex">
            <button 
              (click)="viewMode.set('list')" 
              [class.bg-white]="viewMode() === 'list'"
              [class.text-blue-700]="viewMode() === 'list'"
              [class.text-blue-300]="viewMode() !== 'list'"
              class="p-2 rounded-md transition-all duration-200"
              title="תצוגת רשימה"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button 
              (click)="viewMode.set('map')" 
              [class.bg-white]="viewMode() === 'map'"
              [class.text-blue-700]="viewMode() === 'map'"
              [class.text-blue-300]="viewMode() !== 'map'"
              class="p-2 rounded-md transition-all duration-200"
              title="תצוגת מפה"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Search Bar (Only visible in list or if desired in map) -->
      <div class="relative">
        <input 
          [formControl]="searchControl"
          type="text" 
          placeholder="חפש לפי עיר או שם תחנה..."
          class="w-full p-3 pr-10 rounded-lg text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
        />
        <span class="absolute top-3 right-3 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
      </div>

      <!-- Brand Filter Chips -->
      <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button 
          (click)="clearFilter()"
          [class.bg-white]="!stationService.selectedBrand()"
          [class.text-blue-700]="!stationService.selectedBrand()"
          [class.bg-blue-600]="stationService.selectedBrand()"
          [class.text-blue-100]="stationService.selectedBrand()"
          class="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
        >
          הכל
        </button>
        @for (brand of stationService.availableBrands(); track brand) {
          <button 
            (click)="setBrand(brand)"
            [class.bg-white]="stationService.selectedBrand() === brand"
            [class.text-blue-700]="stationService.selectedBrand() === brand"
            [class.bg-blue-800]="stationService.selectedBrand() !== brand"
            [class.text-blue-100]="stationService.selectedBrand() !== brand"
            class="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
          >
            {{ brand }}
          </button>
        }
      </div>
    </header>

    <!-- Content Area -->
    <main class="h-[calc(100vh-220px)] relative">
      @if (stationService.isLoading()) {
        <div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-100 border-t-blue-600 mb-3"></div>
          <p class="text-blue-800 font-medium animate-pulse">טוען נתונים...</p>
        </div>
      }

      @if (viewMode() === 'list') {
        <div class="p-4 space-y-3 h-full overflow-y-auto pb-safe">
          @if (stationService.filteredStations().length === 0) {
            <div class="text-center py-10 text-gray-500">
              <p class="text-lg">לא נמצאו תחנות תואמות לחיפוש.</p>
              <button (click)="clearAll()" class="mt-4 text-blue-600 font-medium hover:underline">נקה חיפוש</button>
              
              @if (stationService.stations().length === 0 && !stationService.isLoading()) {
                <div class="mt-8 pt-8 border-t border-gray-100">
                  <p class="text-sm text-gray-400 mb-2">מסד הנתונים ריק?</p>
                  <button (click)="stationService.seedStations()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    אתחל נתונים ראשוניים (Seed)
                  </button>
                </div>
              }
            </div>
          }

          @for (station of stationService.filteredStations(); track station.name) {
            <a [routerLink]="['/station', station.name]" class="block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform">
              <div class="p-4 flex justify-between items-start">
                
                <!-- Icon & Info -->
                <div class="flex gap-3">
                  <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                    {{ getInitials(station.brand) }}
                  </div>
                  
                  <div>
                    <h2 class="font-bold text-gray-900 leading-tight">{{ station.name }}</h2>
                    <p class="text-sm text-gray-600 mt-1">{{ station.city_he }} • {{ station.address }}</p>
                    <div class="flex items-center gap-2 mt-2">
                      <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {{ station.brand }}
                      </span>
                      @if (station.status) {
                        <span class="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                          תקלה זמנית
                        </span>
                      }
                    </div>
                  </div>
                </div>

                <!-- Price -->
                <div class="text-left">
                  @if (station.price_ils) {
                    <div [class]="stationService.getPriceColorClass(station.price_ils)" class="text-xl font-black">
                      {{ station.price_ils }} ₪
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1">
                      עודכן: {{ station.last_updated }}
                    </div>
                  } @else {
                    <div class="text-gray-400 text-sm font-medium">אין מחיר</div>
                  }
                </div>
              </div>
            </a>
          }
        </div>
      } @else {
        <!-- Map View -->
        <app-station-map [stations]="stationService.filteredStations()"></app-station-map>
      }

      <!-- Add Station FAB -->
      <a routerLink="/add" class="fixed bottom-6 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform active:scale-90 flex items-center justify-center mb-safe" title="הוסף תחנה חדשה">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </a>

    </main>
    
    <!-- Import Modal Removed -->
  `
})
export class StationListComponent {
  stationService = inject(StationService);
  searchControl = new FormControl('');
  viewMode = signal<ViewMode>('list');

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe(value => {
        this.stationService.searchQuery.set(value || '');
      });
  }

  setBrand(brand: string) {
    this.stationService.selectedBrand.set(brand);
  }

  clearFilter() {
    this.stationService.selectedBrand.set(null);
  }

  clearAll() {
    this.searchControl.setValue('');
    this.clearFilter();
  }

  getInitials(brand: string): string {
    return brand.substring(0, 2).toUpperCase();
  }

  // Import feature removed in favor of Firestore sync
}