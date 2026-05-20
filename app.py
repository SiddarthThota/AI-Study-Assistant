import streamlit as st
import ollama
from fpdf import FPDF
import speech_recognition as sr
from datetime import datetime

# =========================================
# PAGE CONFIG
# =========================================
st.set_page_config(
    page_title="AI Personalized Study Assistant",
    page_icon="📚",
    layout="wide"
)

# =========================================
# CUSTOM CSS
# =========================================
st.markdown("""
<style>

.stApp {
    background-color: #0E1117;
    color: white;
}

h1, h2, h3 {
    color: white;
}

.stButton>button {
    background-color: #262730;
    color: white;
    border-radius: 10px;
    height: 3em;
    width: 100%;
    font-size: 16px;
}

.stTextInput>div>div>input {
    background-color: #262730;
    color: white;
}

.stSelectbox>div>div {
    background-color: #262730;
    color: white;
}

.stTextArea textarea {
    background-color: #262730;
    color: white;
}

</style>
""", unsafe_allow_html=True)

# =========================================
# SESSION STATE
# =========================================
if "notes" not in st.session_state:
    st.session_state.notes = ""

if "quiz" not in st.session_state:
    st.session_state.quiz = ""

if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

if "current_topic" not in st.session_state:
    st.session_state.current_topic = ""

if "history" not in st.session_state:
    st.session_state.history = []

if "flashcards" not in st.session_state:
    st.session_state.flashcards = ""

# =========================================
# SIDEBAR
# =========================================
st.sidebar.title("📚 Navigation")

page = st.sidebar.radio(
    "Go To",
    [
        "Study Notes",
        "Quiz",
        "Flashcards",
        "AI Chatbot"
    ]
)

# =========================================
# STUDY NOTES PAGE
# =========================================
if page == "Study Notes":

    st.title("📚 AI Personalized Study Assistant")

    topic = st.text_input("Enter Topic")

    difficulty = st.selectbox(
        "Select Difficulty",
        ["Beginner", "Intermediate", "Advanced"]
    )

    # =====================================
    # GENERATE NOTES
    # =====================================
    if st.button("Generate Study Notes"):

        if topic == "":

            st.warning("Please enter a topic.")

        else:

            st.session_state.notes = ""
            st.session_state.quiz = ""

            st.session_state.current_topic = topic

            prompt = f"""
            Explain {topic} in simple {difficulty} level.

            Include:
            - Explanation
            - 3 key points
            - 1 example
            - Summary
            """

            try:

                with st.spinner("Generating Study Notes..."):

                    response = ollama.chat(
                        model="tinyllama",
                        messages=[
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ]
                    )

                    notes = response["message"]["content"]

                    st.session_state.notes = notes

                    # SAVE HISTORY
                    st.session_state.history.append(
                        {
                            "topic": topic,
                            "notes": notes,
                            "time": datetime.now().strftime("%H:%M:%S")
                        }
                    )

                    st.success("Notes Generated Successfully!")

            except Exception as e:
                st.error(f"Error: {e}")

    # =====================================
    # DISPLAY NOTES
    # =====================================
    if st.session_state.notes != "":

        st.subheader("📘 Study Notes")

        st.write(st.session_state.notes)

        # =================================
        # PDF DOWNLOAD
        # =================================
        try:

            pdf = FPDF()

            pdf.add_page()

            pdf.set_font("Arial", size=12)

            clean_text = st.session_state.notes.encode(
                "latin-1",
                "replace"
            ).decode("latin-1")

            pdf.multi_cell(0, 10, clean_text)

            pdf.output("study_notes.pdf")

            with open("study_notes.pdf", "rb") as file:

                st.download_button(
                    label="⬇ Download Notes as PDF",
                    data=file,
                    file_name="study_notes.pdf",
                    mime="application/pdf"
                )

        except Exception as e:
            st.error(f"PDF Error: {e}")

        # =================================
        # GENERATE QUIZ
        # =================================
        if st.button("Generate Quiz"):

            quiz_prompt = f"""
            Create 3 MCQ quiz questions on:

            {st.session_state.current_topic}

            Format:

            Question:
            A)
            B)
            C)
            D)

            Correct Answer:
            """

            try:

                with st.spinner("Generating Quiz..."):

                    quiz_response = ollama.chat(
                        model="tinyllama",
                        messages=[
                            {
                                "role": "user",
                                "content": quiz_prompt
                            }
                        ]
                    )

                    st.session_state.quiz = quiz_response["message"]["content"]

                    st.success("Quiz Generated Successfully!")

            except Exception as e:
                st.error(f"Quiz Error: {e}")

        # =================================
        # GENERATE FLASHCARDS
        # =================================
        if st.button("Generate Flashcards"):

            flash_prompt = f"""
            Create 5 flashcards for:

            {st.session_state.current_topic}

            Format:

            Q:
            A:
            """

            try:

                with st.spinner("Generating Flashcards..."):

                    flash_response = ollama.chat(
                        model="tinyllama",
                        messages=[
                            {
                                "role": "user",
                                "content": flash_prompt
                            }
                        ]
                    )

                    st.session_state.flashcards = flash_response["message"]["content"]

                    st.success("Flashcards Generated!")

            except Exception as e:
                st.error(f"Flashcard Error: {e}")

        # =================================
        # NOTES HISTORY
        # =================================
        st.subheader("📜 Notes History")

        for i, item in enumerate(st.session_state.history):

            with st.expander(f"{item['topic']} ({item['time']})"):

                st.write(item["notes"])

# =========================================
# QUIZ PAGE
# =========================================
elif page == "Quiz":

    st.title("🎯 Quiz")

    if st.session_state.quiz == "":

        st.warning("Please generate quiz first.")

    else:

        st.write(st.session_state.quiz)

        st.markdown("---")

        st.subheader("🧠 Self Evaluation")

        score = 0

        q1 = st.radio(
            "1. Did you understand the topic?",
            ["Yes", "Partially", "No"]
        )

        if q1 == "Yes":
            score += 1

        q2 = st.radio(
            "2. Can you explain it to someone?",
            ["Yes", "Partially", "No"]
        )

        if q2 == "Yes":
            score += 1

        q3 = st.radio(
            "3. Are you confident with examples?",
            ["Yes", "Partially", "No"]
        )

        if q3 == "Yes":
            score += 1

        if st.button("Submit Evaluation"):

            st.success(f"🎉 Score: {score}/3")

            if score == 3:
                st.balloons()
                st.success("Excellent Work!")

            elif score == 2:
                st.info("Good Job!")

            else:
                st.warning("Keep Practicing!")

# =========================================
# FLASHCARDS PAGE
# =========================================
elif page == "Flashcards":

    st.title("🃏 AI Flashcards")

    if st.session_state.flashcards == "":

        st.warning("Generate flashcards first.")

    else:

        st.write(st.session_state.flashcards)

# =========================================
# AI CHATBOT PAGE
# =========================================
elif page == "AI Chatbot":

    st.title("💬 AI Study Chatbot")

    st.write("Ask questions using text or voice.")

    # =====================================
    # VOICE INPUT
    # =====================================
    st.subheader("🎤 Voice Input")

    voice_text = ""

    if st.button("Start Voice Input"):

        recognizer = sr.Recognizer()

        try:

            with sr.Microphone() as source:

                st.info("🎙 Listening... Speak now.")

                recognizer.adjust_for_ambient_noise(
                    source,
                    duration=1
                )

                audio = recognizer.listen(
                    source,
                    timeout=10,
                    phrase_time_limit=8
                )

                voice_text = recognizer.recognize_google(audio)

                st.success(f"You said: {voice_text}")

        except sr.WaitTimeoutError:
            st.warning("No voice detected.")

        except sr.UnknownValueError:
            st.warning("Could not understand audio.")

        except sr.RequestError:
            st.error("Speech recognition service unavailable.")

        except Exception as e:
            st.error(f"Voice Error: {e}")

    # =====================================
    # TEXT INPUT
    # =====================================
    user_input = st.chat_input("Ask something...")

    final_input = ""

    if voice_text != "":
        final_input = voice_text

    elif user_input:
        final_input = user_input

    # =====================================
    # PROCESS CHAT
    # =====================================
    if final_input != "":

        st.session_state.chat_history.append(
            {
                "role": "user",
                "content": final_input
            }
        )

        with st.chat_message("user"):
            st.markdown(final_input)

        with st.chat_message("assistant"):

            with st.spinner("Thinking..."):

                try:

                    response = ollama.chat(
                        model="tinyllama",
                        messages=st.session_state.chat_history[-4:]
                    )

                    bot_reply = response["message"]["content"]

                    st.markdown(bot_reply)

                    st.session_state.chat_history.append(
                        {
                            "role": "assistant",
                            "content": bot_reply
                        }
                    )

                except Exception as e:
                    st.error(f"Chatbot Error: {e}")

    # =====================================
    # CHAT HISTORY
    # =====================================
    st.subheader("🧠 Chat History")

    for msg in st.session_state.chat_history:

        if msg["role"] == "user":

            with st.chat_message("user"):
                st.markdown(msg["content"])

        else:

            with st.chat_message("assistant"):
                st.markdown(msg["content"])

    # =====================================
    # CLEAR CHAT
    # =====================================
    if st.button("🗑 Clear Chat"):

        st.session_state.chat_history = []

        st.success("Chat Cleared!")

# =========================================
# FOOTER
# =========================================
st.markdown("---")

st.caption("🚀 Built with Streamlit + Ollama + TinyLlama")