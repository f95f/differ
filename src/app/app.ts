import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Differ } from './differ/differ';

@Component({
  selector: 'app-root',
  imports: [
    Differ,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('differ');
}
