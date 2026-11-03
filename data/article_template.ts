import { flowchartTikz } from '../services/flowchartExport';
export const ARTICLE_PREAMBLE = String.raw`\documentclass[10pt,a4paper]{article}
\usepackage{iftex}
\ifPDFTeX
  \usepackage[T1]{fontenc}
  \usepackage[utf8]{inputenc}
\else
  \usepackage{fontspec}
\fi
\usepackage[margin=20mm]{geometry}
\usepackage{booktabs,longtable,array}
\usepackage{tikz,pgfplots}
\usetikzlibrary{arrows.meta,positioning}
\pgfplotsset{compat=1.18}
\usepackage{hyperref}
\hypersetup{hidelinks}
\setlength{\emergencystretch}{3em}
\author{FrameSIM export}
\date{}
`;
export const FLOWCHART_TIKZ = flowchartTikz();
