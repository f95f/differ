import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

@Component({
  selector: 'app-differ',
  imports: [
    MonacoEditorModule,
    FormsModule 
  ],
  templateUrl: './differ.html',
  styleUrl: './differ.scss'
})
export class Differ {
  
}
