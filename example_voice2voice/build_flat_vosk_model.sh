#!/usr/bin/env bash
# flatten_vosk_model.sh  <unzipped-model-folder>
set -e

MODEL=$1
IMAGE=kaldiasr/kaldi:latest

docker run --rm -v "$PWD":/work $IMAGE bash -euxo pipefail -c '
  MODEL='"$MODEL"'
  cd /work/$MODEL

  # Locate fstcompose first (works for any kaldi image)
  FSTBIN=$(find /opt/kaldi -path "*/openfst*/bin" -type d | head -n1)
  if [ -z "$FSTBIN" ]; then echo "❌ OpenFST bin dir not found"; exit 1; fi

  # Plugin directory for look-ahead FST
  FSTLIB=$(dirname "$FSTBIN")/lib
  export LD_LIBRARY_PATH=$FSTLIB

  echo "Using tools in $FSTBIN"
  echo "Using plugins in $FSTLIB"
  
  LSFSTLIB=$(ls "$FSTLIB")
  echo  "ls LSFSTLIB: $LSFSTLIB"

  LSFSTBIN=$(ls "$FSTBIN")
  echo  "ls FSTBIN: $LSFSTBIN"

  "$FSTBIN/fstcompose"   graph/HCLr.fst graph/Gr.fst |
  "$FSTBIN/fstsymbols" graph/disambig_tid.int      |
  "$FSTBIN/fstconvert" --fst_type=const > HCLG.fst

  cp am/final.mdl .
  [ -f graph/words.txt ] && cp graph/words.txt .

  echo "✅  Flattened: HCLG.fst  final.mdl  words.txt now at model root."
'
