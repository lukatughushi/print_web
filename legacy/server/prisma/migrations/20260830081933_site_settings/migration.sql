-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "announcementText" TEXT,
    "announcementActive" BOOLEAN NOT NULL DEFAULT true,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "heroCtaText" TEXT,
    "heroCtaLink" TEXT,
    "freeShipThreshold" INTEGER NOT NULL DEFAULT 150,
    "currency" TEXT NOT NULL DEFAULT '₾',
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contactAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
