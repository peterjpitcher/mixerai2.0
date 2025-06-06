import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import '../../app/globals.css'; // Corrected path

const CulturalResonancePage = () => {
  return (
    <>
      <Head>
        <title>Cultural Resonance with MixerAI 2.0 | Deep Dive for Our Brands</title>
        <meta name="description" content="Understand how MixerAI 2.0 drives authentic cultural resonance for deeper market penetration and loyalty for our brands." />
      </Head>

      <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
        {/* Removed Header Section */}

        {/* Page Title Section - Full Width */}
        <section 
          className="w-full py-16 md:py-24 text-white text-center bg-cover bg-center shadow-lg relative"
          style={{ backgroundImage: "url('https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2')" }} // Close up of different types of pasta
        >
          <div className="absolute inset-0 bg-blue-600 opacity-70"></div> {/* Gradient overlay */}
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">Deep Dive: Authentic Cultural Resonance for Our Brands</h2>
            <p className="text-lg md:text-xl max-w-3xl mx-auto px-4">
              Moving beyond translation to true local understanding. See how MixerAI 2.0 empowers our brands to connect authentically, driving share of search and market across diverse global audiences.
            </p>
          </div>
        </section>

        {/* Main Content Section */}
        <main className="container mx-auto px-6 py-12 md:py-16 flex-grow">
          <div className="bg-white p-8 md:p-12 rounded-xl shadow-xl">
            <article className="prose prose-lg max-w-none text-gray-800">
              <p>
                In today's global marketplace, simply translating our message isn't enough. Consumers expect brands to understand and respect their unique cultural nuances, traditions, and values. Failure to do so can lead to content that feels alienating, irrelevant, or worse, offensive. MixerAI 2.0 is engineered to address this critical challenge head-on for our content strategy.
              </p>

              <h3>The Power of Speaking Like a Local</h3>
              <p>
                MixerAI 2.0 leverages advanced AI to analyse and understand the specific cultural contexts of our target markets. This means our content isn't just linguistically accurate; it's infused with the local idiom, references, and sensitivities that make it feel genuinely native. For example, our MAT's can ensure product descriptions for a breakfast cereal highlight its convenience for busy mornings in one market, while emphasizing its nutritional benefits for active families in another. For our BDT's, this provides the confidence that global brand narratives are being adapted respectfully and effectively. For our MAT's, it means having the power to create content that truly speaks the language of their customers, leading to:
              </p>
              <ul>
                <li><strong>Increased Share of Search:</strong> Content that uses locally relevant keywords and addresses local interests naturally performs better in search engines, making our brands more discoverable.</li>
                <li><strong>Enhanced Consumer Engagement:</strong> When consumers feel understood, they are more likely to engage with our content, share it, and develop a positive perception of our brand.</li>
                <li><strong>Boosted Market Share:</strong> Authentic connection builds trust and preference, directly contributing to increased market penetration and sales growth for our brands.</li>
              </ul>

              <div className="my-8 md:my-12 clearfix">
                <img 
                  src="https://images.pexels.com/photos/699953/pexels-photo-699953.jpeg?auto=compress&cs=tinysrgb&w=1000&h=700&dpr=2" 
                  alt="Bowl of fresh vegetable salad representing authentic local food" 
                  className="rounded-lg shadow-xl float-right ml-6 mb-4 md:w-1/2 lg:w-2/5 xl:w-1/3" 
                  style={{ maxWidth: '450px' }}/>
              </div>

              <h3>Beyond Words: Understanding Cultural Nuance</h3>
              <p>
                Cultural resonance goes beyond just words. It involves understanding visual preferences, colour symbolism, humour, social etiquette, and even the unwritten rules of communication within a specific region. MixerAI 2.0 provides insights and guidance that help our MAT's navigate these complexities, ensuring that every aspect of our content – from tone of voice in an article to imagery in a newsletter – is culturally appropriate and impactful. For our food brands, this extends to optimising recipes to match local palates or ensuring that food-related content uses locally available ingredients and familiar culinary terminology.
              </p>
              <p>
                Our BDT's can set the strategic framework and core brand values, and MixerAI 2.0 equips our MAT's with the intelligence to bring those values to life in a way that resonates deeply within each unique market. This collaborative approach ensures both global consistency and local relevance, a key factor in building strong, enduring global brands.
              </p>

              <h3>Drive ROI with Content That Connects</h3>
              <p>
                Investing in culturally resonant content isn't just about brand building; it's about smart business. By ensuring our messaging truly connects, we reduce wasted spend on campaigns that miss the mark. MixerAI 2.0 helps optimise our non-working media ROI by ensuring the content created is highly effective from the outset, leading to better campaign performance and a stronger bottom line.
              </p>

              <div className="mt-12 text-center">
                <Link href="/overview#learn-more" className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-blue-700 transition duration-300 ease-in-out">
                  &larr; Back to Overview
                </Link>
              </div>
            </article>
          </div>
        </main>

        {/* AI Taskforce Disclaimer Section */}
        <section className="py-12 bg-yellow-50 border-t border-yellow-200">
          <div className="container mx-auto px-6 text-center">
            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md border border-yellow-300">
              <h3 className="text-xl font-semibold mb-3 text-yellow-700">Important Notice: AI Taskforce Approval</h3>
              <p className="text-gray-700 leading-relaxed">
                Please note: All use cases must be submitted and approved through the AI Taskforce before content can be set live on any public domain. Brands can use the system to test and trial without setting it live until approval is received.
              </p>
            </div>
          </div>
        </section>

        {/* Footer - Consistent with Overview */}
        <footer className="py-8 bg-gray-800 text-gray-400 text-center mt-auto">
          <div className="container mx-auto px-6">
            <p>&copy; {new Date().getFullYear()} MixerAI. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default CulturalResonancePage; 