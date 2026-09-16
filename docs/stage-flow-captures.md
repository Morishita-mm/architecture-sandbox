# 学習開始から自由設計までの画面キャプチャ

2026-09-15、ローカル版をPC幅1255×963で撮影。画像は縦方向を含む全画面キャプチャです。教材用の架空データを使い、実際の操作で全8ステージと卒業課題を順番に通過しました。AI APIへの通信は0件。アプリのコードや利用者の保存データは変更していません。

01. [ホーム：学習と自由設計の入口](#screen-01)
02. [学習マップ：開始前](#screen-02)
03. [Web Browser：役割を体験](#screen-03)
04. [Web Browser：練習問題](#screen-04)
05. [練習：操作が未達のフィードバック](#screen-05)
06. [ステージクリア：結果と理由を確認](#screen-06)
07. [学習マップ：次のステージが開放](#screen-07)
08. [App Server：役割を体験](#screen-08)
09. [App Server：練習問題](#screen-09)
10. [RDBMS (SQL)：役割を体験](#screen-10)
11. [RDBMS (SQL)：練習問題](#screen-11)
12. [Load Balancerの準備：必要量の見積もり](#screen-12)
13. [Load Balancer：役割を体験](#screen-13)
14. [Load Balancer：練習問題](#screen-14)
15. [Distributed Cache：役割を体験](#screen-15)
16. [Distributed Cache：練習問題](#screen-16)
17. [Message Queue：役割を体験](#screen-17)
18. [Message Queue：練習問題](#screen-18)
19. [Worker (Async)：役割を体験](#screen-19)
20. [Worker (Async)：練習問題](#screen-20)
21. [API Gateway：役割を体験](#screen-21)
22. [API Gateway：練習問題](#screen-22)
23. [卒業課題：条件から構成を選び、理由を記録](#screen-23)
24. [入門コース修了：8種類の学びを振り返る](#screen-24)
25. [自由設計：卒業課題の図とメモを引き継ぐ](#screen-25)

<a id="screen-01"></a>

## 01. ホーム：学習と自由設計の入口

初学者は左の学習コース、経験者は右の自由設計から始めます。

![ホーム：学習と自由設計の入口](images/stage-flow/01.png)

<a id="screen-02"></a>

## 02. 学習マップ：開始前

基本8種類の順序、各ステージの役割・到達目標・開放条件を確認します。

![学習マップ：開始前](images/stage-flow/02.png)

<a id="screen-03"></a>

## 03. Web Browser：役割を体験

要求を送り、返事を表示してブラウザの役割を体験。右側で役割の問いに答えます。

![Web Browser：役割を体験](images/stage-flow/03.png)

<a id="screen-04"></a>

## 04. Web Browser：練習問題

体験とは別の貸出状況の題材で、自分で操作して理由を答えます。

![Web Browser：練習問題](images/stage-flow/04.png)

<a id="screen-05"></a>

## 05. 練習：操作が未達のフィードバック

回答が合っていても、要求の送信・表示が未達ならクリアせず、見直す場所を示します。

![練習：操作が未達のフィードバック](images/stage-flow/05.png)

<a id="screen-06"></a>

## 06. ステージクリア：結果と理由を確認

操作と理由の確認がそろうと、クリア表示と次のステージへのボタンが出ます。

![ステージクリア：結果と理由を確認](images/stage-flow/06.png)

<a id="screen-07"></a>

## 07. 学習マップ：次のステージが開放

Web Browserがクリア済みになり、App Serverを学習できるようになります。

![学習マップ：次のステージが開放](images/stage-flow/07.png)

<a id="screen-08"></a>

## 08. App Server：役割を体験

ブラウザとアプリの経路をつなぎ、要求に応じた返事を受け取ります。

![App Server：役割を体験](images/stage-flow/08.png)

<a id="screen-09"></a>

## 09. App Server：練習問題

貸出できる道具を尋ねる要求を、接続したアプリへ送る練習です。

![App Server：練習問題](images/stage-flow/09.png)

<a id="screen-10"></a>

## 10. RDBMS (SQL)：役割を体験

保存・アプリ再起動・読み出しで、一時記憶とDBの違いを比較します。

![RDBMS (SQL)：役割を体験](images/stage-flow/10.png)

<a id="screen-11"></a>

## 11. RDBMS (SQL)：練習問題

貸出記録をDBに残し、アプリを再起動して読み出す練習です。

![RDBMS (SQL)：練習問題](images/stage-flow/11.png)

<a id="screen-12"></a>

## 12. Load Balancerの準備：必要量の見積もり

負荷分散の前に、利用者数・頻度・集中度を変えて必要量を見積もります。

![Load Balancerの準備：必要量の見積もり](images/stage-flow/12.png)

<a id="screen-13"></a>

## 13. Load Balancer：役割を体験

台数・振り分け・1台停止・DBの処理上限を変え、結果を比べます。

![Load Balancer：役割を体験](images/stage-flow/13.png)

<a id="screen-14"></a>

## 14. Load Balancer：練習問題

アプリAが停止した場面で、稼働中のBに6件の要求を届ける練習です。

![Load Balancer：練習問題](images/stage-flow/14.png)

<a id="screen-15"></a>

## 15. Distributed Cache：役割を体験

読み出しの減少と、更新後に古いコピーが返る様子を比較します。

![Distributed Cache：役割を体験](images/stage-flow/15.png)

<a id="screen-16"></a>

## 16. Distributed Cache：練習問題

変更後の会場が表示されるよう、古いコピーを無効化する練習です。

![Distributed Cache：練習問題](images/stage-flow/16.png)

<a id="screen-17"></a>

## 17. Message Queue：役割を体験

同期処理とキューを比べ、受付と完了が別であることを確かめます。

![Message Queue：役割を体験](images/stage-flow/17.png)

<a id="screen-18"></a>

## 18. Message Queue：練習問題

Workerが止まっていても通知の仕事を受け付け、待機させる練習です。

![Message Queue：練習問題](images/stage-flow/18.png)

<a id="screen-19"></a>

## 19. Worker (Async)：役割を体験

停止・再開・同じ仕事の再配信・重複防止を操作して比較します。

![Worker (Async)：役割を体験](images/stage-flow/19.png)

<a id="screen-20"></a>

## 20. Worker (Async)：練習問題

同じ仕事が2件届いた場面で、通知を1回だけ実行する練習です。

![Worker (Async)：練習問題](images/stage-flow/20.png)

<a id="screen-21"></a>

## 21. API Gateway：役割を体験

入口の利用制限、許可枠の補充、利用者側の再試行を体験します。

![API Gateway：役割を体験](images/stage-flow/21.png)

<a id="screen-22"></a>

## 22. API Gateway：練習問題

7件の要求を、利用制限と再試行で失わず処理する練習です。

![API Gateway：練習問題](images/stage-flow/22.png)

<a id="screen-23"></a>

## 23. 卒業課題：条件から構成を選び、理由を記録

条件に合う構成を比較し、選んだ理由と残る課題を記録します。

![卒業課題：条件から構成を選び、理由を記録](images/stage-flow/23.png)

<a id="screen-24"></a>

## 24. 入門コース修了：8種類の学びを振り返る

全8種類の到達目標とクリアを振り返り、各ステージの復習もできます。

![入門コース修了：8種類の学びを振り返る](images/stage-flow/24.png)

<a id="screen-25"></a>

## 25. 自由設計：卒業課題の図とメモを引き継ぐ

卒業課題で選んだ構成とメモを、通常の自由設計画面で編集できます。

![自由設計：卒業課題の図とメモを引き継ぐ](images/stage-flow/25.png)

