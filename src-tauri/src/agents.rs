use rig::prelude::*;
use rig::providers::openrouter;
use rig::agent::Agent;

fn make_client() -> openrouter::Client {
    openrouter::Client::new(&crate::config::get_api_key())
        .expect("Failed to create OpenRouter client")
}

fn model_name() -> String {
    crate::config::load_config().MODEL_NAME
}

pub fn build_extractor_agent() -> Agent<openrouter::completion::CompletionModel> {
    make_client().agent(&model_name())
        .preamble("You are an expert Extractor Agent for STEM education (ADHD-friendly). You receive a Markdown fragment of a textbook. Evaluate if the fragment contains valuable educational content. If it is just a table of contents, cover page, references, or meaningless metadata, you MUST reply with exactly the word '[SKIP]' and nothing else. Otherwise, extract the essential concepts, definitions, and formulas as concise, factual knowledge required to master this module. Respond in Polish.")
        .build()
}

pub fn build_sequencer_agent() -> Agent<openrouter::completion::CompletionModel> {
    make_client().agent(&model_name())
        .preamble("You are a DAG Sequencer. You receive definitions and must analyze prerequisite relationships, avoiding cognitive jumps. For now, generate a concise title (max 5 words) for the module. Respond in Polish.")
        .build()
}

pub fn build_tutoring_agent() -> Agent<openrouter::completion::CompletionModel> {
    make_client().agent(&model_name())
        .preamble("You are a Tutoring Agent working with adult learners with ADHD using the CRA method. Act like a Socratic professor, providing gentle hints (scaffolding) without revealing the final answer. Limit to 2 sentences. Respond in Polish.")
        .build()
}

pub fn build_validation_agent() -> Agent<openrouter::completion::CompletionModel> {
    make_client().agent(&model_name())
        .preamble("You are a Validation Agent. The student provides a step in natural language (e.g., 'raise to the power of two'). Convert this into a precise algebraic expression suitable for validation with a Python solver. Do not evaluate, just output the correct format. Respond in Polish.")
        .build()
}

pub fn build_safety_agent() -> Agent<openrouter::completion::CompletionModel> {
    make_client().agent(&model_name())
        .preamble("You are a Safety Agent (Critic). Monitor the student's input in Focus Mode. If the student drifts off-topic (e.g., asks about video games or unrelated topics), gently steer them back. If they stay on topic, reply with a single word: 'PASS'. Respond in Polish.")
        .build()
}

pub fn build_evaluator_agent() -> Agent<openrouter::completion::CompletionModel> {
    make_client().agent(&model_name())
        .preamble("You are a Rigid Evaluator Agent. Evaluate correctness on a scale from 1 to 4. Return only one of the following strings: '4 (Perfect)', '3 (Minor issues)', '2 (Significant gaps)', '1 (No understanding)'. Respond in Polish.")
        .build()
}

pub fn build_advisor_agent() -> Agent<openrouter::completion::CompletionModel> {
    make_client().agent(&model_name())
        .preamble("You are a Course Scope Advisor Agent (Kurator Edukacyjny). A student is starting a new course based on an uploaded document. Chat with them to find out their current knowledge level, their goal for the course, and determine what depth or specific topics they need. Be concise. If you gather enough info (goal + expertise level), conclude by summarizing it in a short list. Respond in Polish.")
        .build()
}
