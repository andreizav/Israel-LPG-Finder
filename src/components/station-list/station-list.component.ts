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
          <button 
            (click)="toggleImportModal()" 
            class="bg-blue-800 text-blue-300 p-2 rounded-lg hover:bg-blue-700 transition-colors" 
            title="ייבוא נתונים"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>

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
    
    <!-- Import JSON Modal -->
    @if (isImportModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" (click)="toggleImportModal()">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
          <div class="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 class="font-bold text-lg text-gray-800">ייבוא נתונים (JSON)</h3>
            <button (click)="toggleImportModal()" class="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="p-4 flex-1 overflow-hidden flex flex-col">
            <p class="text-sm text-gray-600 mb-2">הדבק כאן את תוכן קובץ ה-JSON:</p>
            <textarea 
              [formControl]="importText"
              class="w-full flex-1 p-3 border rounded-xl font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              placeholder='[{"name": "Station Name", ...}]'
            ></textarea>
          </div>

          <div class="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <button (click)="toggleImportModal()" class="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
              ביטול
            </button>
            <button 
              (click)="importFromJsonText()" 
              [disabled]="!importText.value"
              class="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ייבוא נתונים
            </button>
          </div>
        </div>
      </div>
    }
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

  onFileSelected(event: Event) {
    // Removed
  }

  isImportModalOpen = signal(false);
  importText = new FormControl('');

  toggleImportModal() {
    this.isImportModalOpen.update(v => !v);
    if (!this.isImportModalOpen()) {
      this.importText.setValue('');
    }
  }

  importFromJsonText() {
    const text = this.importText.value;
    if (text) {
      const success = this.stationService.importStations(text);
      if (success) {
        alert('הנתונים יובאו בהצלחה!');
        this.toggleImportModal();
      } else {
        alert('שגיאה בייבוא הנתונים. פורמט JSON לא תקין.');
      }
    }
  }
}