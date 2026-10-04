"""Corpus adapters. Importing this package registers every built-in corpus."""

from . import ai_village, collusion_wiki, generic  # noqa: F401
from .base import Corpus, all_corpora, applicable, get, register  # noqa: F401
