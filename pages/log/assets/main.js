window.onload = get_recent();

function get_recent() {
    let recent = document.getElementsByClassName("recent").children;
    $.ajax({
        type: "POST",
        url: "/api",
        data: JSON.stringify({token: sessionStorage.getItem("token") || null, method: "get_recent"})
    }).done((j) => {
        let data = JSON.parse(j);
        console.log(data)
        //if (data.error) {console.log(data.error)} // debugging
        //if (data.token) {console.log(data.token)/*debugging*/;sessionStorage.setItem("token", data.token)}
        //for (var prop of data.content) {
        //    console.log(prop);
        //    //recent[Object.keys(prop)[0]].innerHTML = prop;
        //}
    })
}