import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTextCompletion } from '@/lib/azure/openai';

// Define the expected request body schema
const WorkflowDetailsSchema = z.object({
  workflowName: z.string().min(1, { message: 'Workflow name is required' }),
  brandName: z.string().optional(),
  templateName: z.string().optional(),
  stepNames: z.array(z.string()).optional(),
  brandCountry: z.string().optional(),
  brandLanguage: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = WorkflowDetailsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { workflowName, brandName, templateName, stepNames, brandCountry, brandLanguage } = validationResult.data;

    const systemPrompt = "You are an expert marketing copywriter. Your task is to generate a concise and engaging marketing description for a content workflow.";

    let userPrompt = `Generate a concise and engaging marketing description for a workflow named \"${workflowName}\".`;
    if (brandName) {
      userPrompt += ` This workflow is specifically designed for the brand \"${brandName}\".`;
    }
    if (brandCountry && brandLanguage) {
      userPrompt += ` It targets the ${brandCountry} market and uses the ${brandLanguage} language.`;
    }
    if (templateName) {
      userPrompt += ` It often utilizes the \"${templateName}\" content template.`;
    }
    if (stepNames && stepNames.length > 0) {
      userPrompt += ` The workflow involves the following key stages or steps: ${stepNames.join(', ')}.`;
    } else {
      userPrompt += ` It is a flexible workflow, and specific steps can be defined as needed.`;
    }
    userPrompt += ` Highlight its primary purpose and benefits in streamlining content creation and approval processes. The description should be suitable for a dashboard overview and be around 2-3 sentences long.`;

    // Call the actual AI generation function
    const generatedDescription = await generateTextCompletion(systemPrompt, userPrompt, 150); // Max 150 tokens for a description

    if (!generatedDescription) {
      console.error('[API_GENERATE_WORKFLOW_DESCRIPTION] AI generation failed or returned null.');
      return NextResponse.json(
        { success: false, error: 'AI failed to generate workflow description. Please try again later.' },
        { status: 503 } // Service Unavailable
      );
    }

    return NextResponse.json({ 
      success: true, 
      description: generatedDescription.trim() 
    });

  } catch (error) {
    console.error('[API_GENERATE_WORKFLOW_DESCRIPTION_ERROR]', error);
    // Check if the error is a Zod validation error for more specific client feedback
    if (error instanceof z.ZodError) {
        return NextResponse.json(
            { success: false, error: 'Invalid request payload.', details: error.format() },
            { status: 400 }
        );
    }
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while generating the workflow description.' },
      { status: 500 }
    );
  }
} 