import React, { ChangeEventHandler, useEffect, useRef, useState } from 'react';
import { render } from 'react-dom';
import main from './main';

const styles = {
  left: {
    padding: 10,
    // height: '20%',
  },
  input: {
    width: '90%',
  },
  refresh: {
    marginRight: 4,
  },
  right: {
    // height: '80%',
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0,
  },
};

function displayUrl(
  url: string,
  hash: string,
  animate: boolean,
  parent: HTMLDivElement,
) {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = url;
  img.onload = () => {
    // TODO: this is super hacky
    (window as any).img = img;
    console.log(img.width, img.height);

    const scale = Math.min(img.width, img.height) < 1000 ? 2 : 1;
    main(parent, hash, animate, img.width * scale, img.height * scale);
  };
}

const App = () => {
  const [currentUrl, setCurrentUrl] = useState(
    'https://gateway.fxhash.xyz/ipfs/QmXP8qPwzwnuduvYaomfvKNyF38gyo2oDeakwiqXKwu2iQ',
  );
  const [lastUrl, setLastUrl] = useState(currentUrl);
  const [hash, setHash] = useState(() => window.createHash());
  const [animate, setAnimate] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const handleGo = (withHash = hash) => {
    if (canvasRef.current && currentUrl) {
      displayUrl(
        currentUrl,
        withHash,
        animate,
        // 'https://gateway.fxhash.xyz/ipfs/QmajeWvwSqgqfhdvFDchLq3rL4dARuV4gEVCqQ4WVAZsG3',
        // https://gateway.fxhash.xyz/ipfs/QmRX3xDuQKD2H8dPBHckyJz7tSEjVuuNdreM8kuJJG9eaD
        canvasRef.current,
      );
    }
    setLastUrl(currentUrl);
  };

  const handleNewHash = () => {
    const newHash = window.createHash();
    setHash(newHash);
  };

  useEffect(() => handleGo(), [hash, animate]);

  const handleUrlChange: ChangeEventHandler<HTMLInputElement> = event => {
    setCurrentUrl(event.target.value);
  };
  const handleHashChange: ChangeEventHandler<HTMLInputElement> = event => {
    setHash(event.target.value);
  };
  const toggleAnimate = () => setAnimate(x => !x);

  return (
    <>
      <div style={styles.left}>
        <div>
          Url:
          <input
            type='text'
            style={styles.input}
            value={currentUrl}
            onChange={handleUrlChange}
          />
          <button disabled={currentUrl === lastUrl} onClick={() => handleGo()}>
            Update
          </button>
        </div>
        <div>
          Hash:
          <input
            type='text'
            style={styles.input}
            value={hash}
            onChange={handleHashChange}
          />{' '}
          <button style={styles.refresh} onClick={handleNewHash}>
            🔄
          </button>
        </div>
        <div>
          Animate:{' '}
          <input type='checkbox' checked={animate} onClick={toggleAnimate} />
        </div>
      </div>
      <div style={styles.right} ref={canvasRef} />
    </>
  );
};

render(<App />, document.getElementById('root'));
