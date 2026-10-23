#!/bin/bash
# 졸업복·학교·단체 사진 → 콜라주 스티커 (images/grad/)
cd "$(dirname "$0")/.."
T=tools/collage.py; R=images/raw2; O=images/grad
# 질감 없이 원본 사진 + 흰 스티커 테두리 (수채화 질감은 --plain 을 빼면 적용)
mk() { python3 "$T" "$R/$1" "$O/$2.png" --plain --size 1300 "${@:3}" >/dev/null && echo "$2"; }
mk "하준.JPG" hajun_g1 --crop 4:5 --focus 0.42,0.5 --seed 1
mk "하준2.jpg" hajun_g2 --crop 3:4 --focus 0.5,0.45 --seed 2
mk "하준 드럼.JPG" hajun_drum --edge rect --crop 4:3 --focus 0.62,0.5 --seed 3
mk "근호2.JPG" geunho_g1 --crop 4:5 --focus 0.5,0.5 --seed 4
mk "근호.JPG" geunho_g2 --crop 3:4 --focus 0.5,0.45 --seed 5
mk "근호3.jpg" geunho_g3 --edge rect --crop 4:3 --focus 0.45,0.5 --seed 6
mk "주원.JPG" juwon_g1 --crop 4:5 --focus 0.55,0.45 --seed 7
mk "주원2.jpg" juwon_g2 --crop 4:5 --focus 0.45,0.4 --seed 8
mk "주원 보컬.JPG" juwon_vocal --edge rect --seed 9
mk "규연.JPG" gyuyeon_g1 --crop 4:5 --focus 0.55,0.5 --seed 10
mk "규연2.JPG" gyuyeon_g2 --edge rect --crop 4:3 --focus 0.45,0.5 --seed 11
mk "규연, 주원.jpg" gyuyeon_juwon --edge rect --crop 4:3 --focus 0.55,0.6 --seed 12
mk "유건.JPG" yugeon_g1 --crop 4:5 --focus 0.55,0.5 --seed 13
mk "유건3.JPG" yugeon_g2 --crop 4:5 --focus 0.45,0.55 --seed 14
mk "유건2.jpg" yugeon_g3 --edge rect --crop 4:3 --focus 0.4,0.6 --seed 15
mk "태연.JPG" taeyeon_g1 --crop 1:1 --focus 0.45,0.45 --seed 16
mk "태연2.JPG" taeyeon_g2 --crop 4:5 --focus 0.55,0.5 --seed 17
mk "태연2.jpg" taeyeon_g3 --edge rect --crop 4:3 --focus 0.45,0.6 --seed 18
mk "태연 베이스.JPG" taeyeon_bass --edge rect --crop 4:3 --focus 0.5,0.5 --seed 19
mk "유민.JPG" yumin_g1 --crop 4:5 --focus 0.5,0.5 --seed 20
mk "유민2.jpg" yumin_g2 --crop 3:4 --focus 0.4,0.5 --seed 21
mk "졸업복 단체1.JPG" group1 --edge rect --crop 3:2 --focus 0.5,0.55 --seed 22
mk "졸업복 단체2.JPG" group2 --edge rect --crop 3:2 --focus 0.5,0.55 --seed 23
mk "졸업복 단체3.JPG" group3 --edge rect --crop 3:2 --focus 0.5,0.55 --seed 24
# 학교 사진은 v3 모습(수채화 질감) 유지
python3 "$T" "$R/IMG_3590.JPG" "$O/school.png" --edge rect --crop 16:9 --focus 0.5,0.5 --seed 25 --size 1300 >/dev/null && echo school
