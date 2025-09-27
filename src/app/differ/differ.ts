import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, inject, NgZone, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiffEditorModel, MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { debounceTime, Subject } from 'rxjs';

interface IDiffEditorModel {
  language: string;
  code: string;
  length: number;
}

@Component({
  selector: 'app-differ',
  imports: [
    MonacoEditorModule,
    FormsModule,
  ],
  templateUrl: './differ.html',
  styleUrl: './differ.scss'
})
export class Differ {

  @ViewChild('diffEditor') 
  diffEditorComponent: any;

  private ngZone = inject(NgZone);
  private client = inject(HttpClient);

  private update$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  originalModel: IDiffEditorModel = {
    language: 'plaintext',
    code: '',
    length: 0
  };

  modifiedModel: IDiffEditorModel = {
    language: 'plaintext',
    code: '',
    length: 0
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
    this.client.get('/current-running-example-before.txt', { responseType: 'text' })
    .subscribe(data => {
      this.originalModel = { ...this.originalModel, code: data, length: data.length };
      this.update$.next();
    });
    this.client.get('/current-running-example-after.txt', { responseType: 'text' })
    .subscribe(data => {
      this.modifiedModel = { ...this.modifiedModel, code: data, length: data.length };
      this.update$.next();
    });
  }

  // convenience API to inject text programmatically
  setOriginalText(text: string) {
    this.originalModel = { ...this.originalModel, code: text, length: text.length };
    this.update$.next();
  }
  setModifiedText(text: string) {
    this.modifiedModel = { ...this.modifiedModel, code: text, length: text.length };
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

      // get the internal Monaco diff editor instance
      const monacoDiffEditor = diffComp.getDiffEditor ? diffComp.getDiffEditor() : diffComp._editor;
      if (monacoDiffEditor) {
        // lineChanges contains hunks info (ILineChange[])
        const lineChanges = monacoDiffEditor.getLineChanges();
        console.log('lineChanges/hunks:', lineChanges);
      }

      if (monacoDiffEditor && monacoDiffEditor.getModifiedEditor) {
        const originalEditor = monacoDiffEditor.getOriginalEditor();
        if (originalEditor) {
          originalEditor.onDidChangeModelContent(() => {
            const value = originalEditor.getModel().getValue();
            this.originalModel.length = value.length;
            this.originalModel.code = value;
            // trigger change detection if needed
            this.ngZone.run(() => {});
          });
      }
        const modifiedEditor = monacoDiffEditor.getModifiedEditor();
        if (modifiedEditor) {
          modifiedEditor.onDidChangeModelContent(() => {
            const value = modifiedEditor.getModel().getValue();
            this.modifiedModel.length = value.length;
            this.modifiedModel.code = value;
            this.ngZone.run(() => {});
          });
        }
        // clear previous decorations stored in a property
        (modifiedEditor as any).__myDecos = (modifiedEditor as any).__myDecos || [];
        (modifiedEditor as any).__myDecos = modifiedEditor.deltaDecorations(
          (modifiedEditor as any).__myDecos,
          [
            {
              range: new (window as any).monaco.Range(1, 1, 1, 120),
              options: { isWholeLine: true }
            }
          ]
        );
      }
    } catch (err) {
      console.warn('applyModelsToEditor error', err);
    }
  }

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
