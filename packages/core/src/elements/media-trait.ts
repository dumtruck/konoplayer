import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  interval,
  map,
  merge, Observable,
  Subject,
  type Subscription, switchMap, takeUntil, tap,
} from 'rxjs';
import {NetworkState, ReadyState} from "./state.ts";

export interface Metadata {
  duration: number
}

export abstract class VideoElementTrait {
  private playbackTimer: Subscription | undefined;

  _src$ = new BehaviorSubject<string>('');
  _currentTime$ = new BehaviorSubject<number>(0);
  _duration$ = new BehaviorSubject<number>(Number.NaN);
  _paused$ = new BehaviorSubject<boolean>(true);
  _ended$ = new BehaviorSubject<boolean>(false);
  _volume$ = new BehaviorSubject<number>(1.0);
  _muted$ = new BehaviorSubject<boolean>(false);
  _playbackRate$ = new BehaviorSubject<number>(1.0);
  _readyState$ = new BehaviorSubject<number>(0); // HAVE_NOTHING
  _networkState$ = new BehaviorSubject<number>(0); // NETWORK_EMPTY
  _width$ = new BehaviorSubject<number>(0);
  _height$ = new BehaviorSubject<number>(0);
  _videoWidth$ = new BehaviorSubject<number>(0); // 只读，视频内在宽度
  _videoHeight$ = new BehaviorSubject<number>(0); // 只读，视频内在高度
  _poster$ = new BehaviorSubject<string>('');

  _destroyRef$ =  new Subject<void>();


  _progress$ = new Subject<Event>();
  _error$ = new Subject<Event>();
  _abort$ = new Subject<Event>();
  _emptied$ = new Subject<Event>();
  _stalled$ = new Subject<Event>();
  _loadeddata$ = new Subject<Event>();
  _playing$ = new Subject<Event>();
  _waiting$ = new Subject<Event>();
  _seeked$ = new Subject<Event>();
  _timeupdate$ = new Subject<Event>();
  _play$ = new Subject<Event>();
  _resize$ = new Subject<Event>();

  _setCurrentTime$ = new Subject<number>();
  _setSrc$ = new Subject<string>();
  _callLoadMetadataStart$ = new Subject<void>();
  _callLoadMetadataEnd$ = new Subject<Metadata>();
  _callLoadDataStart$ = new Subject<Metadata>();
  _callLoadDataEnd$ = new Subject<void>();

  protected constructor() {
    this._setCurrentTime$.pipe(
      takeUntil(this._destroyRef$))
    .subscribe(this._currentTime$)

    this.seeking$.pipe(
      takeUntil(this._destroyRef$),
      switchMap(() => this._seek()),
      map(() => new Event("seeked"))
    ).subscribe(this._seeked$)

    this._setSrc$.pipe(
      takeUntil(this._destroyRef$),
    ).subscribe(this._src$)
    this._setSrc$.pipe(
      takeUntil(this._destroyRef$),
      switchMap(() => this._load())
    ).subscribe();

    this._readyState$.pipe(
      takeUntil(this._destroyRef$),
      filter((r) => r === ReadyState.HAVE_NOTHING),
      map(() => 0)
    ).subscribe(this._currentTime$);
    this._readyState$.pipe(
      takeUntil(this._destroyRef$),
      filter((r) => r === ReadyState.HAVE_NOTHING),
      map(() => true),
    ).subscribe(this._paused$);
    this._readyState$.pipe(
      takeUntil(this._destroyRef$),
      filter((r) => r === ReadyState.HAVE_NOTHING),
      map(() => false)
    ).subscribe(this._ended$)

    this._callLoadMetadataStart$.pipe(
      takeUntil(this._destroyRef$),
      map(() => NetworkState.NETWORK_LOADING)
    ).subscribe(
      this._networkState$
    );

    this._callLoadDataEnd$.pipe(
      takeUntil(this._destroyRef$),
      map(() => NetworkState.NETWORK_IDLE)
    ).subscribe(this._networkState$);
    this._callLoadMetadataEnd$.pipe(
      takeUntil(this._destroyRef$),
      map(() => ReadyState.HAVE_METADATA)
    ).subscribe(this._readyState$)

    this._callLoadMetadataEnd$.pipe(
      takeUntil(this._destroyRef$),
      map(meta => meta.duration)
    ).subscribe(this._duration$);

    this._callLoadDataEnd$.pipe(
      takeUntil(this._destroyRef$),
      map(() => ReadyState.HAVE_CURRENT_DATA)
    ).subscribe(this._readyState$);
  }

  get canplay$ () {
    return this._readyState$.pipe(
      filter((s) => {
        return s >= ReadyState.HAVE_CURRENT_DATA
      }),
      distinctUntilChanged(),
      map(() => new Event('canplay')),
    )
  }

  get canplaythrough$ () {
    return this._readyState$.pipe(
      filter((s) => s >= ReadyState.HAVE_ENOUGH_DATA),
      distinctUntilChanged(),
      map(() => new Event('canplaythrough')),
    )
  }

  get seeked$ () {
    return this._seeked$.asObservable();
  }

  get loadstart$() {
    return this._readyState$.pipe(
      filter((s) => s === ReadyState.HAVE_ENOUGH_DATA),
      distinctUntilChanged(),
      map(() => new Event('loadstart'))
    )
  }

  get loadedmetadata$() {
    return this._readyState$.pipe(
      filter((r) => r >= ReadyState.HAVE_METADATA),
      distinctUntilChanged(),
      map(() => new Event('loadedmetadata'))
    );
  }

  get pause$() {
    return this._paused$.pipe(
      distinctUntilChanged(),
      filter(s => s),
      map(() => new Event('pause'))
    )
  }

  get volumechange$() {
    return merge(
      this._volume$,
      this._muted$,
    ).pipe(
      map(() => new Event('volumechange'))
    )
  }

  get ratechange$() {
    return this._playbackRate$.pipe(
      map(() => new Event('ratechange'))
    )
  }

  get durationchange$() {
    return this._duration$.pipe(
      map(() => new Event('durationchange'))
    )
  }

  get ended$() {
    return this._ended$.pipe(
      distinctUntilChanged(),
      filter(s => s),
      map(() => new Event('ended'))
    )
  }

  get seeking$() {
    return this._setCurrentTime$.pipe(
      map(() => new Event('seeking'))
    )
  }

  // 属性 getter/setter
  get src(): string {
    return this._src$.value;
  }

  set src(value: string) {
    this._setSrc$.next(value);
  }

  get currentTime(): number {
    return this._currentTime$.value;
  }

  set currentTime(value: number) {
    if (value < 0 || value > this.duration) {
      return
    }
    this._setCurrentTime$.next(
      value
    )
    this._seeked$.next(new Event('seeked'));
    this._timeupdate$.next(new Event('timeupdate'));
  }

  get duration(): number {
    return this._duration$.value;
  }

  get paused(): boolean {
    return this._paused$.value;
  }

  get ended(): boolean {
    return this._ended$.value;
  }

  get volume(): number {
    return this._volume$.value;
  }

  set volume(value: number) {
    if (value < 0 || value > 1) {
      return
    }
    this._volume$.next(value);
  }

  get muted(): boolean {
    return this._muted$.value;
  }

  set muted(value: boolean) {
    this._muted$.next(value);
  }

  get playbackRate(): number {
    return this._playbackRate$.value;
  }

  set playbackRate(value: number) {
    if (value <= 0) {
      return;
    }
    this._playbackRate$.next(value);
  }

  get readyState(): number {
    return this._readyState$.value;
  }

  get networkState(): number {
    return this._networkState$.value;
  }

  load(): void {
    this._load()
  }

  // 方法
  _load(): Observable<void> {
    this._callLoadMetadataStart$.next(undefined);
    return this._loadMetadata()
      .pipe(
        tap((metadata) => this._callLoadMetadataEnd$.next(metadata)),
        tap((metadata) => this._callLoadDataStart$.next(metadata)),
        switchMap((metadata) => this._loadData(metadata)),
        tap(() => this._callLoadDataEnd$)
      )
  }

  play(): Promise<void> {
    if (!this._paused$.value) {
      return Promise.resolve()
    }
    if (this._readyState$.value < ReadyState.HAVE_FUTURE_DATA) {
      this._waiting$.next(new Event('waiting'));
      return Promise.reject(new Error('Not enough data'));
    }

    this._paused$.next(false);
    this._play$.next(new Event('play'));
    this._playing$.next(new Event('playing'));

    // 模拟播放进度
    this.playbackTimer = this._playbackRate$.pipe(
      switchMap(playbackRate => interval(1000 / playbackRate)),
      takeUntil(
        merge(
          this._paused$,
          this._destroyRef$,
          this._ended$
        )
      )
    ).subscribe(() => {
      const newTime = this.currentTime + 1;
      if (newTime >= this.duration) {
        this._currentTime$.next(this.duration);
        this._paused$.next(true);
        this._ended$.next(true);
      } else {
        this._currentTime$.next(newTime);
        this._timeupdate$.next(new Event('timeupdate'));
      }
    });

    return Promise.resolve();
  }

  pause(): void {
    if (this._paused$.value) {
      return;
    }
    this._paused$.next(true);
  }

  canPlayType(type: string): string {
    // 简化的实现，实际需要根据 MIME 类型检查支持情况
    return type.includes('video/mp4') ? 'probably' : '';
  }

  addTextTrack(kind: string, label: string, language: string): void {
    // 实现文本轨道逻辑（此处简化为占位符）
    console.log(`Added text track: ${kind}, ${label}, ${language}`);
  }

  abstract _seek (): Observable<void>

  abstract _loadMetadata (): Observable<Metadata>

  abstract _loadData(metadata: Metadata): Observable<void>

  [Symbol.dispose]() {
    this._destroyRef$.next(undefined)
  }
}