import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { environment } from './src/environments/environment';
import { AppComponent } from './src/app.component';
import { routes } from './src/app.routes';

// Initialize Firebase globally for direct SDK usage
initializeApp(environment.firebase);

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient()
  ]
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.
