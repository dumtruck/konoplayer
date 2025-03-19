import { html, css, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { type Subscription, switchMap, take } from 'rxjs';
import { createEbmlController } from './media/mkv/reactive';

export class VideoPipelineDemo extends LitElement {
  @property()
  src!: string;

  subscripton?: Subscription;

  static styles = css``;

  async prepareVideoPipeline() {
    if (!this.src) {
      return;
    }

    const { controller$ } = createEbmlController(this.src);

    this.subscripton = controller$
      .pipe(
        switchMap(({ segments$ }) => segments$.pipe(take(1))),
        switchMap(({ seek }) => seek(0))
      )
      .subscribe((cluster) => console.log(cluster));

    const videoDecoder = new VideoDecoder({
      output: (frame) => {},
      error: (e) => {
        e;
      },
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.prepareVideoPipeline();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscripton?.unsubscribe();
  }

  render() {
    return html`<video />`;
  }
}
