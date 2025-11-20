import { Directive, ElementRef, EventEmitter, OnDestroy, Output, Renderer2 } from '@angular/core';

@Directive({ selector: '[clickOutside]' })
export class ClickOutsideDirective implements OnDestroy {
  @Output() clickOutside = new EventEmitter<Event>();
  private unlisten: (() => void) | null = null;

  constructor(private elementRef: ElementRef, private renderer: Renderer2) {
    this.unlisten = this.renderer.listen('document', 'click', (event: Event) => {
      const target = event.target as Node;
      if (!this.elementRef.nativeElement.contains(target)) {
        this.clickOutside.emit(event);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }
  }
}
