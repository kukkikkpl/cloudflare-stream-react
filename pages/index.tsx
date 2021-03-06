import Head from 'next/head'
import styles from '../styles/Home.module.css'
import React, { Component } from 'react';
import { HttpRequest, HttpResponse, PreviousUpload, Upload, UploadOptions } from 'tus-js-client';
import { VideoPlayer } from '../components/video-player';

const CLOUDFLARE_ACCOUNT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID
const CLOUDFLARE_API_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_API_TOKEN

type HomeState = {
  selectedFile?: File;
  fileName: string;
  uploadPercentage: number;
  videoId: string;
  uploadingVideoId?: string;
}

class Home extends Component<{}, HomeState> {
  upload?: Upload;
  mockUserId: string = '123';
  mockVideoId: string = '6b9c94923b3b25dffbdcd69febb5b846';

  constructor(props = {}) {
    super(props);
    this.state = {
      fileName: '',
      uploadPercentage: 0,
      videoId: this.mockVideoId,
    };
  }

  changeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    this.setState({selectedFile: event.target.files[0]});
    this.setState({fileName: event.target.files[0]?.name || this.state.fileName});
  }

  uploadVideo = () => {
    if (!this.state.selectedFile) return;
    const file = this.state.selectedFile;
    const tusUploadOptions = {
      chunkSize: 20 * 1024 * 1024, // Required a minimum chunk size of 5MB
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`,
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      metadata: {
        filename: file.name,
        filetype: file.type,
        name: this.state.fileName,
      },
      uploadSize: file.size,
      onError: (error: Error) => {
        console.log(error.message);
      },
      onProgress: (bytesUploaded: number, bytesTotal: number) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        this.setState({uploadPercentage: +percentage})
        console.log(bytesUploaded, bytesTotal, percentage + "%");
      },
      onSuccess: () => {
        console.log('Upload finished');
        // If set state right here, an error will be occurred because uploading is not finished yet.
        // this.setState({ videoId: this.state.uploadingVideoId || this.state.videoId })
        // TODO: Using webhook to notify when finish uploading
        //  (https://developers.cloudflare.com/stream/uploading-videos/using-webhooks)
      },
      onAfterResponse: (req: HttpRequest, res: HttpResponse) => {
        return new Promise<void>((resolve) => {
          const mediaIdHeader = res.getHeader("stream-media-id");
          if (mediaIdHeader) {
            this.setState({uploadingVideoId: mediaIdHeader});
          }
          resolve();
        });
      },
      removeFingerprintOnSuccess: true,  // allow uploading duplicated file
    } as UploadOptions;

    this.upload = new Upload(file, tusUploadOptions);
    this.startOrResumeUpload(this.upload);

  }

  startOrResumeUpload = (upload: Upload) => {
    upload.findPreviousUploads().then((previousUploads: PreviousUpload[]) => {
      console.log(previousUploads);
      console.log(upload);
      // Found previous uploads so we select the first one.
      if (previousUploads.length) {
        console.log('resume from previous')
        upload.resumeFromPreviousUpload(previousUploads[0])
      }
      // Start the upload
      upload.start()
    })
  }

  abortUpload = () => {
    if (!this.upload) return;
    this.upload.abort();
  }

  resumeUpload = () => {
    if (!this.upload) return;
    this.startOrResumeUpload(this.upload);
  }

  render() {
    return (
      <div className={styles.container}>
        <Head>
          <title>Cloudflare Stream with Google Analytic</title>
          <meta name="description" content="Generated by create next app"/>
          <link rel="icon" href="/favicon.ico"/>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GOOGLE_ANALYTIC_ID}`}/>
          <script dangerouslySetInnerHTML={{
            __html: `
            <!-- Global site tag (gtag.js) - Google Analytics -->
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('set', 'user_properties', { 'user_id_dimension': '${this.mockUserId}' });
            gtag('config', '${process.env.NEXT_PUBLIC_GOOGLE_ANALYTIC_ID}', { 'debug_mode':true , 'user_id': '${this.mockUserId}' });
          `
          }}/>
        </Head>

        <main className={styles.main}>
          <progress value={this.state.uploadPercentage} max='100'>{this.state.uploadPercentage}</progress>
          <span>{this.state.uploadPercentage}%</span>
          <input type="file" onChange={this.changeHandler}/>
          <input
            id="fileName" type="text" value={this.state.fileName}
            onChange={event => this.setState({fileName: event.target.value})}
            placeholder="File name"/>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridColumnGap: '10px'}}>
            <button onClick={this.uploadVideo}>Start upload</button>
            <button onClick={this.abortUpload}>Pause upload</button>
            <button onClick={this.resumeUpload}>Resume upload</button>
          </div>
          {this.state.videoId ? <span>video id = {this.state.videoId}</span> : null}
          <VideoPlayer key={this.state.videoId} videoId={this.state.videoId}/>

        </main>
      </div>
    )
  }
}

export default Home
