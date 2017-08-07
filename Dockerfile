FROM ubuntu:14.04
RUN apt-get update
RUN apt-get install -y clang libsdl2-dev libsdl2-ttf-dev git libtool automake make
RUN apt-get install -y software-properties-common

ENV LD_LIBRARY_PATH=/usr/local/lib
ENV CC=clang
ENV LDLIBS="-lcrypt -lm -ltps -lSDL2 -lSDL2_ttf -lcs50"
ENV CFLAGS="-fsanitize=integer -fsanitize=undefined -ggdb3 -O0 -std=c11 -Wall -Werror -Wextra -Wno-sign-compare -Wshadow"

RUN git clone https://gitlab.com/bramas/libtps.h.git
RUN cd libtps.h && sudo make install

RUN sudo apt-add-repository ppa:cs50/ppa
RUN sudo apt-get update
RUN sudo apt-get install libcs50

VOLUME /var/src
WORKDIR /var/src
CMD ["sh", "run.sh"]


