from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import ORJSONResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
import base64
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from dotenv import load_dotenv
import os
load_dotenv()

class ChatMessage(BaseModel):
    user_text: str

# origins=[
#     "http://localhost:5173"
# ]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai = OpenAI(
    api_key= os.getenv('DEEP_Infra_API'),
    base_url="https://api.deepinfra.com/v1/openai",
)

chat_llm = ChatGroq(
     model="llama-3.2-90b-vision-preview",
    temperature=0,
    api_key= os.getenv('GROQ_API'),
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

def response_query(llm_response: str):
    for i in llm_response:
        yield i

messages = [SystemMessage(content="You are a helpful assistant that answers user's questions based on the image provided in a concise way")]
summary = ""

@app.post("/analyze-image/", response_class=ORJSONResponse)
async def analyze_image(file: UploadFile = File(...)):
    global summary
    try:
        
        image_data = await file.read()
        base64_image = base64.b64encode(image_data).decode("utf-8")

        
        chat_completion = openai.chat.completions.create(
            model="meta-llama/Llama-3.2-90B-Vision-Instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        },
                        {
                            "type": "text",
                            "text": (
                                "What’s in this image? Give me every detail. Please analyze the image provided "
                                "and give me a comprehensive description. Include details about:\n"
                                "- General Content: Describe what is depicted in the image.\n"
                                "- Components: Identify any objects, figures, or elements present.\n"
                                "- Context: Explain the setting or background of the image.\n"
                                "- Technical Aspects: For technical or mathematical images, detail any diagrams, "
                                "graphs, equations, or symbols, and their meanings.\n"
                                "- Relationships: Discuss any interactions or relationships between elements in "
                                "the image.\n"
                                "- Notable Features: Highlight any unique or significant characteristics, labels, "
                                "or markings."
                            )
                        }
                    ]
                }
            ]
        )

        
        summary = chat_completion.choices[0].message.content
        return ORJSONResponse(content={"result": summary})

    except Exception as e:
        print(f"Error in analyze_image: {e}")
        raise HTTPException(status_code=500, detail="Error analyzing image.")
    
@app.post('/analyze-pdf/')
async def analysePdf(file= UploadFile(...)):
    pass


@app.post('/chat/')
async def chat_with_image(text: ChatMessage):
    global messages
    user_text = text.user_text
    try:     
        user_message = HumanMessage(content=f"Image: {summary}\n\nUser Question: {user_text}")
        response = chat_llm.invoke(messages + [user_message])
        response_content = response.content
        messages += [HumanMessage(user_text), AIMessage(response_content)]
        return StreamingResponse(response_query(llm_response=response_content))

    except Exception as e:
        print(f"Error in chat_with_image: {e}")
        raise HTTPException(status_code=500, detail="Error processing chat.")

@app.post('/reset-summary/')
async def reset_summary():
    global summary, messages
    summary = ""
    messages = [SystemMessage(content="You are a helpful assistant that answers user's questions based on the image provided in a concise way")]
    return ORJSONResponse(content={"detail": "Summary reset successfully."})

@app.get("/", response_class=HTMLResponse)
async def read_root():
    # with open("index.html") as f:
    #     return f.read()
    return "Hi"