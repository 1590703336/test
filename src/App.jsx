import { useState, useEffect, useRef } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import ReactPlayer from 'react-player';
import "./App.css";
import SrtParser2 from "srt-parser-2"; // 导入 srt-parser-2

function App() {
  const [videoUrl, setVideoUrl] = useState(""); // 新增状态用于存储视频文件路径
  const [subtitles, setSubtitles] = useState([]); // 新增状态用于存储解析后的字幕
  const [currentTime, setCurrentTime] = useState(0); // 新增状态用于存储当前播放时间
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0); // 新增状态用于存储当前字幕索引
  const [playbackRate, setPlaybackRate] = useState(1); // 新增状态用于存储播放速度
  const playerRef = useRef(null); // 使用 useRef 来获取 ReactPlayer 的引用

  function handleSubtitleUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const parser = new SrtParser2(); // 创建 SrtParser2 实例
        const parsedSubtitles = parser.fromSrt(content); // 使用 fromSrt 方法解析字幕
        setSubtitles(parsedSubtitles); // 设置解析后的字幕
      };
      reader.readAsText(file); // 读取文件内容为文本
    }
  } 
  

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        // 切换到上一句
        setCurrentSubtitleIndex((prevIndex) => {          
          const newIndex = Math.max(prevIndex - 1, 0);          
          const startTime = subtitles[newIndex-1].startSeconds;
          if (playerRef.current) {
            playerRef.current.seekTo(startTime, 'seconds');            
          }
          return newIndex;
        });
      } else if (event.key === 'ArrowRight') {
        // 切换到下一句
        setCurrentSubtitleIndex((prevIndex) => {          
          const newIndex = Math.min(prevIndex + 1, subtitles.length - 1);          
          const startTime = subtitles[newIndex-1].startSeconds;
          if (playerRef.current) {
            playerRef.current.seekTo(startTime, 'seconds');
          }
          return newIndex;
        });
      } else if (event.key === 'r') {
        // 重复播放当前句子
        if (subtitles.length > 0) {
          const startTime = subtitles[currentSubtitleIndex].startSeconds;
          if (playerRef.current) {
            playerRef.current.seekTo(startTime, 'seconds');
          }
        }
      } else if (event.key === 'ArrowDown') {
        // 增加播放速度
        setPlaybackRate((prevRate) => Math.min(prevRate + 0.1, 2)); // 最大速度限制为2
      } else if (event.key === 'ArrowUp') {
        // 降低播放速度
        setPlaybackRate((prevRate) => Math.max(prevRate - 0.1, 0.5)); // 最小速度限制为0.5
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [subtitles]); 


  useEffect(() => {
    if (subtitles.length > 0) {
      const currentSubtitle = subtitles.findIndex(subtitle => {
        const startTime = subtitle.startSeconds;
        const endTime = subtitle.endSeconds;
        return currentTime >= startTime && currentTime <= endTime;
      });      
      if (currentSubtitle !== -1 ) {
        setCurrentSubtitleIndex(Number(subtitles[currentSubtitle].id));          
      }
    }
  }, [currentTime]);

  const activeSubtitle = subtitles[currentSubtitleIndex]?.text || '';
 

  return (
    <main className="container">
      <div className="main-content">
        <div className="player-wrapper">
          <ReactPlayer
            ref={playerRef} // 绑定 playerRef
            url={videoUrl} // 使用 videoUrl 状态
            width="100%"
            height="100%"
            controls={true}
            onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)} // 更新当前播放时间
            playing={true} // 确保视频在切换时播放
            progressInterval={100} // 更新进度的间隔
            playbackRate={playbackRate} // 设置播放速度
          />
          <div className="subtitle-overlay">
            <p style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
              <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>{activeSubtitle}</span>
              <span style={{ marginLeft: '3px', marginRight: '3px', position: 'absolute', right: '0' }}>{playbackRate.toFixed(1)}</span>
            </p>
          </div>
        </div>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              setVideoUrl(URL.createObjectURL(file)); // 设置本地文件路径
            }
          }}
        />
        <input
          type="file"
          accept=".srt,.vtt" // 仅接受字幕文件
          onChange={handleSubtitleUpload}
        />
      </div>
      <div className="subtitles" style={{ scrollPaddingTop: 'calc(3 * 1.5em)' }}>
        {subtitles.map((subtitle, index) => {
          const isActive = currentSubtitleIndex == Number(subtitle.id);
          return (
            <div
              key={index}
              className={isActive ? 'active-subtitle' : ''}
              ref={isActive ? (el) => el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }) : null}
              style={{ marginTop: index === 0 ? 'calc(3 * 1.5em)' : '0' }} // 为第一个元素添加额外的顶部间距
            >
              <p>{subtitle.id}  {subtitle.startSeconds} - {subtitle.text}</p>             
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default App;
