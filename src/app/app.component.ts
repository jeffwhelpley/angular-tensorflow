import { Component, OnDestroy, viewChild, ElementRef, signal, ChangeDetectorRef, NgZone } from '@angular/core';
import type { SpeechCommandRecognizer } from '@tensorflow-models/speech-commands';

@Component({
    selector: 'app-root',
    template: `
        @if (initialized()) { @if (listening()) {
        <button (click)="stopListening()">Stop Listening</button>
        } @else {
        <button (click)="startListening()">Start Listening</button>
        } } @else {
        <button (click)="initialize()">Initialize</button>
        }

        <p>Status: {{ status() }}</p>
        <p>Recognized Command: {{ recognizedCommand() }}</p>

        <!-- <canvas #spectrogramCanvas width="300" height="150" style="border: 1px solid black;"></canvas> -->
    `,
})
export class AppComponent implements OnDestroy {
    spectrogramCanvas = viewChild<ElementRef>('spectrogramCanvas');

    initialized = signal(false);
    listening = signal(false);
    status = signal('Need to Initialize');
    recognizedCommand = signal('');

    private recognizer: SpeechCommandRecognizer | undefined;
    private words: string[] = [];

    constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

    async initialize(): Promise<void> {
        const tf = await import('@tensorflow/tfjs');
        tf.setBackend('webgl');
        this.status.set('Loading model...');
        try {
            const speechCommands = await import('@tensorflow-models/speech-commands');
            this.recognizer = speechCommands.create('BROWSER_FFT');
            await this.recognizer.ensureModelLoaded();
            this.words = this.recognizer.wordLabels();
            this.initialized.set(true);
            this.status.set('Model loaded.');
        } catch (error) {
            this.status.set(`Error loading model: ${error}`);
            console.error(error);
        }
    }

    async startListening(): Promise<void> {
        if (!this.recognizer) return;

        this.listening.set(true);
        this.recognizedCommand.set('');
        this.status.set('Listening...');

        // const canvas = this.spectrogramCanvas()?.nativeElement;
        this.recognizer.listen(
            async (result) => {
                const scores = result.scores as Float32Array;
                const maxScoreIndex = scores.indexOf(Math.max(...scores));
                this.recognizedCommand.set(this.words[maxScoreIndex]);

                // this.ngZone.run(() => {
                //     if (result.spectrogram) {
                //         console.log('Spectrogram yes');

                //         this.drawSpectrogram(result.spectrogram, canvas);
                //         this.cdr.detectChanges();
                //     } else {
                //         console.log('Spectrogram no');
                //     }
                // });
            },
            {
                includeSpectrogram: true,
                overlapFactor: 0.5,
                probabilityThreshold: 0.75,
            }
        );
    }

    stopListening(): void {
        if (this.recognizer && this.listening()) {
            this.recognizer.stopListening();
        }
    }

    // drawSpectrogram(spectrogram: speechCommands.SpectrogramData, canvas: HTMLCanvasElement): void {
    //     const ctx = canvas.getContext('2d');
    //     if (!ctx) {
    //         console.log('No context found');
    //         return;
    //     }

    //     const { data, frameSize } = spectrogram;
    //     const width = canvas.width;
    //     const height = canvas.height;
    //     const numFrames = data.length / frameSize;
    //     const pixelWidth = width / numFrames;
    //     const pixelHeight = height / frameSize;

    //     // Normalize the spectrogram data
    //     const minValue = Math.min(...data);
    //     const maxValue = Math.max(...data);
    //     const normalizedData = data.map((value) => (value - minValue) / (maxValue - minValue));

    //     for (let i = 0; i < numFrames; i++) {
    //         for (let j = 0; j < frameSize; j++) {
    //             const value = normalizedData[i * frameSize + j]; // Use normalized value
    //             const gray = Math.floor(255 * (1 - value));
    //             ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    //             ctx.fillRect(i * pixelWidth, height - (j + 1) * pixelHeight, pixelWidth, pixelHeight);
    //         }
    //     }
    // }

    ngOnDestroy(): void {
        this.stopListening();
    }
}
