// @ts-ignore
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper functions to format arrays/objects for HTML
function renderList(items: any[], color = "#4B5563") {
  if (!Array.isArray(items) || items.length === 0) return '';
  return `<ul style="padding-left: 18px; color: ${color}; margin: 0;">${items.map(i => `<li style="margin-bottom: 4px;">${i}</li>`).join('')}</ul>`;
}

function renderFeatures(features: any[]) {
  if (!Array.isArray(features) || features.length === 0) return '';
  return `<ul style="padding-left: 18px; color: #4B5563; margin: 0;">${features.map(f => `<li><b>${f.name}:</b> ${f.description} <i>(${f.benefit})</i></li>`).join('')}</ul>`;
}

function renderKeyFeatures(keyFeatures: any[]) {
  if (!Array.isArray(keyFeatures) || keyFeatures.length === 0) return '';
  return `<ul style="padding-left: 18px; color: #4B5563; margin: 0;">${keyFeatures.map(f => `<li><b>${f.name}:</b> ${f.description} <i>(${f.benefit})</i><br/><span style='color:#10B981;'>Advantage:</span> ${f.competitiveAdvantage}</li>`).join('')}</ul>`;
}

export async function POST(request: Request) {
  try {
    const { email, name, product, preferences } = await request.json();

    if (!email || !name || !product) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Format preferences for email
    const preferencesText = preferences.questions
      .map((q: any, index: number) => {
        const answer = preferences.answers[q.id];
        return `${index + 1}. ${q.text}\n   Your answer: ${answer}`;
      })
      .join('\n\n');

    // Email content
    const mailOptions = {
      from: `"Sales AI" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "You're just one step away from purchasing the product you like!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981; margin-bottom: 20px;">Your Personalized Product Recommendation</h1>
          
          <p style="color: #374151; margin-bottom: 20px;">Hi ${name},</p>
          
          <p style="color: #374151; margin-bottom: 20px;">
            Based on your preferences, we're excited to recommend this product that matches your needs:
          </p>

          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
              <img 
                src="${product.imageUrl || 'https://placehold.co/400x300/e2e8f0/64748b?text=Product+Image'}" 
                alt="${product.title}"
                style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px;"
              />
              <div>
                <h2 style="color: #1F2937; margin-bottom: 10px; font-size: 24px;">${product.title.split('(')[0].trim()}</h2>
                <p style="color: #4B5563; margin-bottom: 10px;">${product.description}</p>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                  <span style="color: #10B981; font-weight: bold; font-size: 24px;">
                    ${product.price.currency} ${product.price.amount.toFixed(2)}
                  </span>
                  ${product.price.isOnSale ? `
                    <span style="background-color: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 9999px; font-size: 12px;">
                      On Sale!
                    </span>
                  ` : ''}
                </div>
                <span style="background-color: #DBEAFE; color: #1E40AF; padding: 4px 8px; border-radius: 9999px; font-size: 12px;">
                  ${product.category}
                </span>
              </div>
            </div>

            <div style="border-top: 1px solid #E5E7EB; padding-top: 20px;">
              <h3 style="color: #1F2937; margin-bottom: 15px; font-size: 18px;">Product Details</h3>
              <div style="background-color: white; padding: 15px; border-radius: 6px;">
                <h4 style="margin-bottom: 8px;">Key Features</h4>
                ${renderKeyFeatures(product.keyFeatures)}
                <h4 style="margin-bottom: 8px;">Features</h4>
                ${renderFeatures(product.features)}
                <h4 style="margin-bottom: 8px;">Pros</h4>
                ${renderList(product.pros, '#059669')}
                <h4 style="margin-bottom: 8px;">Cons</h4>
                ${renderList(product.cons, '#DC2626')}
                <h4 style="margin-bottom: 8px;">Why Buy</h4>
                <p style="color: #4B5563;">${product.whyBuy}</p>
                <h4 style="margin-bottom: 8px;">Rating</h4>
                <p style="color: #4B5563;">${product.rating}</p>
                <h4 style="margin-bottom: 8px;">Stock Status</h4>
                <p style="color: #4B5563;">${product.stockStatus}</p>
                <h4 style="margin-bottom: 8px;">Confidence</h4>
                <p style="color: #4B5563;">${product.confidence}</p>
              </div>
            </div>
          </div>

          <h3 style="color: #1F2937; margin-bottom: 15px; font-size: 18px;">Your Preferences</h3>
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <pre style="color: #4B5563; white-space: pre-wrap; font-family: Arial, sans-serif;">
${preferencesText}
            </pre>
          </div>

          <div style="background-color: #ECFDF5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #065F46; margin-bottom: 10px; font-size: 18px;">Why This Product?</h3>
            <p style="color: #065F46; margin-bottom: 0;">
              This recommendation is based on your specific needs and preferences. We've carefully analyzed your requirements and believe this product would be the perfect match for you!
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="display: inline-block; background-color: #10B981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              View Product Details
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #6B7280; font-size: 14px;">
              Best regards,<br>
              Your Sales AI Team
            </p>
          </div>
        </div>
      `,
    };

    // Send email using Nodemailer
    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info)
    });

  } catch (error) {
    console.error('Error in send-email route:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
} 