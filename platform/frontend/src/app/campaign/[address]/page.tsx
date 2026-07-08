import type { Metadata } from "next";
import CampaignDetailClient from "./CampaignDetailClient";
import {
  CAMPAIGN_PREVIEW_SITE_URL,
  campaignPreviewDescription,
  campaignPreviewImageUrl,
  campaignPreviewTitle,
  getCampaignPreview,
} from "@/lib/campaignPreview";

type CampaignPageProps = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({
  params,
}: CampaignPageProps): Promise<Metadata> {
  const { address } = await params;
  const preview = await getCampaignPreview(address);
  const title = campaignPreviewTitle(preview, address);
  const description = campaignPreviewDescription(preview);
  const canonicalPath = `/campaign/${address.toLowerCase()}`;
  const canonicalUrl = new URL(canonicalPath, CAMPAIGN_PREVIEW_SITE_URL).toString();
  const imageUrl = campaignPreviewImageUrl(address);
  const imageAlt = `${title} on GrowFi`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      siteName: "GrowFi",
      url: canonicalUrl,
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function CampaignDetailPage({ params }: CampaignPageProps) {
  const { address } = await params;
  return <CampaignDetailClient address={address} />;
}

export const dynamicParams = true;
export const revalidate = 60;
