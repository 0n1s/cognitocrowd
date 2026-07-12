import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://trainlylabs.com';

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/terms-of-service`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/refund-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/contributor-guidelines`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];
}