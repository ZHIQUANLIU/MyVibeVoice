import os
import tempfile
import uuid
import subprocess
import imageio_ffmpeg
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from TTS.api import TTS

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load XTTS-v2 for voice cloning
print("Loading XTTS-v2 model...")
# set gpu=True if you have an NVIDIA GPU setup properly, otherwise False.
# For maximum compatibility we set gpu=False by default, but you can change it if you have PyTorch + CUDA
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
print("Model loaded.")

@app.post("/api/process")
async def process_audio(
    audio: UploadFile = File(...),
    mode: str = Form(...),
    targetLang: str = Form(...),
    inputText: str = Form(""),
    geminiKey: str = Form(...)
):
    print(f"Received request: mode={mode}, targetLang={targetLang}")
    
    # Configure Gemini
    genai.configure(api_key=geminiKey)
    model = genai.GenerativeModel('gemini-2.5-flash')

    # Save uploaded audio (reference audio for cloning)
    temp_audio_path = f"temp_input_{uuid.uuid4()}.webm"
    with open(temp_audio_path, "wb") as f:
        f.write(await audio.read())
        
    # Convert webm to wav using imageio_ffmpeg (since torchaudio soundfile backend doesn't support webm natively on windows)
    temp_wav_path = f"temp_input_{uuid.uuid4()}.wav"
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg_exe, "-i", temp_audio_path, "-ac", "1", "-ar", "22050", temp_wav_path, "-y"], capture_output=True)
    
    text_to_speak = ""

    try:
        if mode == "translate":
            print("Uploading audio to Gemini for translation...")
            gemini_audio = genai.upload_file(temp_wav_path)
            prompt = f"Listen to this audio. Transcribe it, then translate the transcription into language code '{targetLang}'. Only output the translated text without any other comments, formatting, or markdown."
            response = model.generate_content([prompt, gemini_audio])
            text_to_speak = response.text.strip()
            print(f"Gemini translation result: {text_to_speak}")
        else:
            print("Using Clone mode...")
            if inputText:
                # We need to read the inputText and translate it if needed.
                # To be safe, we just tell Gemini to translate it to targetLang.
                prompt = f"Translate the following text to language code '{targetLang}'. Only output the translated text without any other comments or formatting:\n\n{inputText}"
                response = model.generate_content(prompt)
                text_to_speak = response.text.strip()
                print(f"Gemini translation result for cloned text: {text_to_speak}")
            else:
                text_to_speak = "Hello, no text was provided."

        # Generate audio using XTTSv2
        output_audio_path = f"temp_output_{uuid.uuid4()}.wav"
        
        # XTTS supported langs: en, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh-cn, ja, hu, ko, hi
        lang_map = {
            'zh': 'zh-cn',
            'en': 'en',
            'ja': 'ja',
            'es': 'es',
            'fr': 'fr',
            'de': 'de'
        }
        xtts_lang = lang_map.get(targetLang, 'en')

        print(f"Generating TTS in {xtts_lang} using XTTS-v2...")
        tts.tts_to_file(
            text=text_to_speak,
            file_path=output_audio_path,
            speaker_wav=temp_wav_path,
            language=xtts_lang
        )
        print("TTS generated successfully.")
        
        # We can clean up the input temp file
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        if os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)

        return FileResponse(output_audio_path, media_type="audio/wav")

    except Exception as e:
        print(f"Error during processing: {e}")
        # Clean up input if failed
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        if os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)
        raise e
