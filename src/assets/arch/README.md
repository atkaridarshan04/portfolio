# Architecture diagram & profile image placement

## Profile image
Path: src/assets/profile.jpg        ← already referenced, just replace the file
Dimensions: any portrait, ideally 640×800 or similar 4:5 aspect ratio
Format: JPG or WebP

## Architecture diagrams
Directory: src/assets/arch/

| File name                     | Used for                           |
|-------------------------------|------------------------------------|
| arch-cloudnative.png          | CloudNative DevOps Blueprint       |
| arch-devsecops.png            | DevSecOps GitHub Actions           |
| arch-mlops.png                | MLOps Platform Blueprint           |
| arch-terraform.png            | Terraform HA Platform              |
| arch-aws-portfolio.png        | AWS Cloud Portfolio                |

Format: PNG or WebP. Landscape orientation (16:9 or 21:9) works best
because project cards use aspect-[16/11] and the flagship uses aspect-[21/10].

## How to wire them up
After adding the files, open:
  src/components/portfolio/sections-projects.tsx

Uncomment and add the imports near the top (one per project you have a diagram for):

  import archCloudnative from "@/assets/arch/arch-cloudnative.png";
  import archDevsecops   from "@/assets/arch/arch-devsecops.png";
  import archMlops       from "@/assets/arch/arch-mlops.png";
  import archTerraform   from "@/assets/arch/arch-terraform.png";
  import archAws         from "@/assets/arch/arch-aws-portfolio.png";

Then in the PROJECTS array, set the archImage field:

  { ..., image: projK8s,    archImage: archCloudnative, ... },
  { ..., image: projDevsec, archImage: archDevsecops,   ... },
  { ..., image: projMlops,  archImage: archMlops,       ... },
  { ..., image: projTf,     archImage: archTerraform,   ... },
  { ..., image: projAws,    archImage: archAws,         ... },

When archImage is set, the project card uses it instead of the stock photo.
The flagship card also shows a small "Architecture" badge in the top-right corner.
