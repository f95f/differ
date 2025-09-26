import { Component, inject, NgZone, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiffEditorModel, MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { debounceTime, Subject } from 'rxjs';

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

  @ViewChild('diffEditor') 
  diffEditorComponent: any;

  private ngZone = inject(NgZone);
  private update$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  originalModel: DiffEditorModel = {
    language: 'plaintext',
    code: `hostname R1
      !
      interface GigabitEthernet0/1
      description Uplink to Switch
      ip address 10.0.0.1 255.255.255.0
      !`
  };

  modifiedModel: DiffEditorModel = {
    language: 'plaintext',
    code: `hostname R1
      !
      interface GigabitEthernet0/1
      description Uplink to Core
      ip address 10.0.0.2 255.255.255.0
      !`
  };

  diffOptions: any = {
    renderSideBySide: true,
    automaticLayout: true,
    minimap: { enabled: false },
    originalEditable: true, // make left editable if you want: true
    renderIndicators: true,
    // new: hide unchanged regions (Monaco option) — useful for long configs
    // note: key supported by Monaco: 'hideUnchangedRegions: { enabled: true }' 
    // (some wrappers accept it directly in options)
    // hideUnchangedRegions: { enabled: false }
  };


  ngOnInit(): void {
    this.update$.pipe(debounceTime(240)).subscribe(() => {
      this.applyModelsToEditor();
    });
  }

  
// called from the template textareas
  onOriginalInput(value: string) {
    this.originalModel = { ...this.originalModel, code: value };
    this.update$.next();
  }
  onModifiedInput(value: string) {
    this.modifiedModel = { ...this.modifiedModel, code: value };
    this.update$.next();
  }

  // convenience API to inject text programmatically
  setOriginalText(text: string) {
    this.originalModel = { ...this.originalModel, code: text };
    this.update$.next();
  }
  setModifiedText(text: string) {
    this.modifiedModel = { ...this.modifiedModel, code: text };
    this.update$.next();
  }

  // sync the wrapper-bound models into the actual Monaco diff editor
  applyModelsToEditor() {
    // the ngx wrapper binds inputs to the internal models automatically,
    // but to ensure we can call methods like getLineChanges now:
    try {
      const diffComp = this.diffEditorComponent; // ViewChild reference
      if (!diffComp) return;

      // if the wrapper offers a setModel API:
      if (typeof diffComp.setModel === 'function') {
        diffComp.setModel({
          original: { value: this.originalModel.code, language: this.originalModel.language },
          modified: { value: this.modifiedModel.code, language: this.modifiedModel.language }
        });
      } else {
        // fallback: set the bound inputs (Angular detects changes)
        // nothing else required
      }

      // Example: get diff info (line changes)
      // get the internal Monaco diff editor instance
      const monacoDiffEditor = diffComp.getDiffEditor ? diffComp.getDiffEditor() : diffComp._editor;
      if (monacoDiffEditor) {
        // lineChanges contains hunks info (ILineChange[])
        const lineChanges = monacoDiffEditor.getLineChanges();
        console.log('lineChanges/hunks:', lineChanges);
      }

      // Example: add a decoration to the modified editor (highlight 1st line)
      if (monacoDiffEditor && monacoDiffEditor.getModifiedEditor) {
        const modifiedEditor = monacoDiffEditor.getModifiedEditor();
        // clear previous decorations stored in a property
        (modifiedEditor as any).__myDecos = (modifiedEditor as any).__myDecos || [];
        (modifiedEditor as any).__myDecos = modifiedEditor.deltaDecorations(
          (modifiedEditor as any).__myDecos,
          [
            {
              range: new (window as any).monaco.Range(1, 1, 1, 120),
              options: { isWholeLine: true, className: 'my-custom-line' }
            }
          ]
        );
      }
    } catch (err) {
      console.warn('applyModelsToEditor error', err);
    }
  }

  // Optional: programmatic reading of merged value (if you let users edit both sides)
  getModifiedText(): string {
    try {
      const diffComp = this.diffEditorComponent;
      const monacoDiffEditor = diffComp.getDiffEditor ? diffComp.getDiffEditor() : diffComp._editor;
      const modifiedEditor = monacoDiffEditor?.getModifiedEditor();
      return modifiedEditor ? modifiedEditor.getModel().getValue() : this.modifiedModel.code;
    } catch {
      return this.modifiedModel.code;
    }
  }


  ngOnDestroy() {
    this.update$.complete();
    this.destroy$.next(void 0);
    this.destroy$.complete();
  }
}
